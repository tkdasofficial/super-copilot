import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Sucrase: lightweight pure-JS TypeScript/JSX transpiler (no WASM, no Workers)
import { transform } from "https://esm.sh/sucrase@3.35.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProjectFile = {
  path: string;
  content: string;
};

type CompileRequest = {
  files: ProjectFile[];
  framework: string;
  dependencies: Record<string, string>;
  entryPoint?: string;
};

/**
 * Transpile a single file using sucrase.
 * Handles TSX, JSX, TypeScript, and regular JS.
 */
function transpileFile(file: ProjectFile, stripImports = true): { code: string; error?: string } {
  const ext = file.path.match(/\.(tsx?|jsx?)$/)?.[1] || "";
  
  // Only apply typescript and jsx transforms — keep ES imports/exports intact
  // so they work with the browser's import map
  const transforms: Array<"typescript" | "jsx"> = [];
  if (ext === "tsx" || ext === "ts") transforms.push("typescript");
  if (ext === "tsx" || ext === "jsx") transforms.push("jsx");
  
  // Skip non-JS files
  if (!ext && !file.path.endsWith(".js")) {
    return { code: file.content };
  }

  // If no transforms needed, return as-is
  if (transforms.length === 0) {
    return { code: stripImports ? stripImportExport(file.content) : file.content };
  }

  try {
    const result = transform(file.content, {
      transforms,
      jsxRuntime: "classic",
      production: false,
      filePath: file.path,
    });
    return { code: stripImports ? stripImportExport(result.code) : result.code };
  } catch (err: any) {
    return { code: "", error: `${file.path}: ${err.message}` };
  }
}

/**
 * Strip ES import/export statements for inline execution in a script module
 * where React etc. are already available via top-level imports.
 */
function stripImportExport(code: string): string {
  let result = code;
  
  // Remove import statements (React etc. are globally available via top-level import)
  result = result.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "");
  result = result.replace(/^import\s+['"].*?['"];?\s*$/gm, "");
  result = result.replace(/^import\s+type\s+.*$/gm, "");
  
  // Remove export default — keep the declaration
  result = result.replace(/^export\s+default\s+/gm, "");
  
  // Remove named exports keyword but keep declarations
  result = result.replace(/^export\s+(?=(?:const|let|var|function|class)\s)/gm, "");
  
  // Remove standalone export { ... } statements
  result = result.replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
  
  return result.trim();
}

/**
 * Find the App component entry point.
 */
function findEntryPoint(files: ProjectFile[], framework: string, hint?: string): string | null {
  if (hint) {
    const found = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (found) return found.path;
  }

  const entries = [
    "src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx",
    "src/main.tsx", "src/main.jsx", "main.tsx", "main.jsx",
    "src/index.tsx", "src/index.jsx", "index.tsx", "index.jsx",
  ];

  for (const entry of entries) {
    if (files.find(f => f.path === entry)) return entry;
  }

  if (framework === "vanilla-html") {
    const vanillaEntries = ["index.html", "src/index.html", "main.js", "script.js"];
    for (const entry of vanillaEntries) {
      if (files.find(f => f.path === entry)) return entry;
    }
  }

  return files.find(f => /\.(tsx?|jsx?)$/.test(f.path))?.path || null;
}

/**
 * Build the import map for external dependencies.
 */
function buildImportMap(dependencies: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {
    "react": "https://esm.sh/react@18.3.1?dev",
    "react/": "https://esm.sh/react@18.3.1/",
    "react-dom": "https://esm.sh/react-dom@18.3.1?dev",
    "react-dom/": "https://esm.sh/react-dom@18.3.1/",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?dev",
    "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime?dev",
    "react-router-dom": "https://esm.sh/react-router-dom@6?dev&deps=react@18.3.1,react-dom@18.3.1",
  };

  for (const [pkg, version] of Object.entries(dependencies)) {
    if (!map[pkg]) {
      const ver = version.replace(/[\^~>=<]*/g, "");
      map[pkg] = `https://esm.sh/${pkg}@${ver}?deps=react@18.3.1,react-dom@18.3.1`;
    }
  }

  return map;
}

/**
 * Extract exported component/function names from transpiled code.
 */
function extractExportedNames(originalCode: string): string[] {
  const names: string[] = [];
  const patterns = [
    /export\s+(?:default\s+)?function\s+(\w+)/g,
    /export\s+(?:default\s+)?class\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+default\s+(\w+)/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(originalCode)) !== null) {
      if (m[1] && m[1][0] === m[1][0].toUpperCase()) {
        names.push(m[1]);
      }
    }
  }
  return [...new Set(names)];
}

function injectConsoleCapture(): string {
  return `<script>
(function() {
  const _log = console.log, _warn = console.warn, _err = console.error;
  function relay(level, args) {
    try {
      const msg = Array.from(args).map(a => {
        if (typeof a === 'object') try { return JSON.stringify(a, null, 2); } catch { return String(a); }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ type: 'console', level, message: msg }, '*');
    } catch {}
  }
  console.log = function() { relay('log', arguments); _log.apply(console, arguments); };
  console.warn = function() { relay('warn', arguments); _warn.apply(console, arguments); };
  console.error = function() { relay('error', arguments); _err.apply(console, arguments); };
  window.onerror = function(msg, src, line) {
    relay('error', [msg + (line ? ' (line ' + line + ')' : '')]);
    showOverlay(String(msg), line);
  };
  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason?.stack || e.reason?.message || String(e.reason);
    relay('error', [msg]);
    showOverlay(msg);
  });
  function showOverlay(message, line) {
    if (document.getElementById('__err')) return;
    const d = document.createElement('div');
    d.id = '__err';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40%;overflow:auto;background:#1e1e2e;color:#f38ba8;font-family:monospace;font-size:12px;padding:12px 16px;z-index:999999;border-top:2px solid #f38ba8';
    d.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><b style="color:#fab387">⚠ Runtime Error</b><button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#6c7086;cursor:pointer;font-size:16px">✕</button></div><pre style="margin:0;white-space:pre-wrap;word-break:break-word">' + message.replace(/</g,'&lt;') + '</pre>';
    document.body.appendChild(d);
  }
})();
<\/script>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CompileRequest = await req.json();
    const { files, framework, dependencies, entryPoint } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Vanilla HTML ───
    if (framework === "vanilla-html") {
      const htmlFile = files.find(f => f.path.endsWith(".html"));
      const cssFiles = files.filter(f => f.path.endsWith(".css"));
      const jsFiles = files.filter(f => /\.(js|ts)$/.test(f.path));
      
      // Transpile JS/TS files
      const transpiledJS: string[] = [];
      const errors: string[] = [];
      for (const js of jsFiles) {
        const result = transpileFile(js);
        if (result.error) errors.push(result.error);
        else transpiledJS.push(result.code);
      }

      const cssContent = cssFiles.map(f => f.content).join("\n");
      let html: string;

      if (htmlFile) {
        html = htmlFile.content;
        // Inline CSS
        for (const css of cssFiles) {
          const pat = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${css.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, "gi");
          html = html.replace(pat, `<style>${css.content}</style>`);
        }
        // Inline transpiled JS
        for (let i = 0; i < jsFiles.length; i++) {
          const js = jsFiles[i];
          const pat = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${js.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, "gi");
          html = html.replace(pat, `<script>${transpiledJS[i] || ""}<\/script>`);
        }
        if (!html.includes("<style>") && cssContent) {
          html = html.replace("</head>", `<style>${cssContent}</style>\n</head>`);
        }
      } else {
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script><style>${cssContent}</style></head><body><script>${transpiledJS.join("\n")}<\/script></body></html>`;
      }

      // Inject console capture
      if (html.includes("</body>")) {
        html = html.replace("</body>", injectConsoleCapture() + "\n</body>");
      } else {
        html += injectConsoleCapture();
      }

      return new Response(
        JSON.stringify({ success: true, html, compiledFiles: files.length, bundleSize: html.length, errors, warnings: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── React / Next.js ───
    const entry = findEntryPoint(files, framework, entryPoint);
    if (!entry) {
      return new Response(
        JSON.stringify({ error: "No entry point found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cssContent = files.filter(f => f.path.endsWith(".css")).map(f => f.content).join("\n");
    const moduleFiles = files.filter(f => /\.(tsx?|jsx?)$/.test(f.path));
    
    // Transpile all module files
    const compiledModules: Array<{ path: string; code: string; exports: string[] }> = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const file of moduleFiles) {
      const result = transpileFile(file);
      if (result.error) {
        errors.push(result.error);
        warnings.push(`Failed to compile ${file.path}`);
        continue;
      }
      
      const exports = extractExportedNames(file.content);
      compiledModules.push({ path: file.path, code: result.code, exports });
    }

    // Find the app entry module
    const appModule = compiledModules.find(m => m.path === entry);
    const otherModules = compiledModules.filter(m => m.path !== entry && !m.path.includes("main."));

    // Build the component setup code (non-entry modules wrapped in IIFEs)
    const componentSetup = otherModules.map(m => {
      const varName = m.path
        .replace(/^src\//, "")
        .replace(/\.(tsx?|jsx?)$/, "")
        .replace(/[\/\-\.]/g, "_");
      const exportList = m.exports.length > 0 ? m.exports.join(", ") : "";
      return `
// ── ${m.path} ──
const __mod_${varName} = (function() {
  ${m.code}
  ${exportList ? `return { ${exportList} };` : "return {};"}
})();`;
    }).join("\n");

    const importMap = buildImportMap(dependencies);
    const importMapJSON = JSON.stringify({ imports: importMap }, null, 2);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script type="importmap">
  ${importMapJSON}
  <\/script>
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React, { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext, useReducer, forwardRef, memo, Fragment, Suspense, lazy } from 'react';
    import { createRoot } from 'react-dom/client';
    import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useLocation, Navigate, Outlet, useSearchParams } from 'react-router-dom';

    ${componentSetup}

    ${appModule?.code || "function App() { return React.createElement('div', {style:{padding:'2rem',textAlign:'center'}}, 'No App component found'); }"}

    const AppComponent = typeof App !== 'undefined' ? App :
                         typeof _default !== 'undefined' ? _default :
                         () => React.createElement('div', {style:{padding:'2rem',textAlign:'center',fontFamily:'system-ui'}},
                           React.createElement('h2', null, '⚠ No App component found'));

    try {
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(AppComponent));
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<div style="padding:2rem;color:#f38ba8;font-family:monospace"><h3>Render Error</h3><pre>' +
        (err.stack || err.message) + '</pre></div>';
      console.error(err);
    }
  <\/script>
  ${injectConsoleCapture()}
</body>
</html>`;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        html,
        compiledFiles: compiledModules.length,
        bundleSize: html.length,
        errors: errors.length > 0 ? errors : undefined,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Compile error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal compilation error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
