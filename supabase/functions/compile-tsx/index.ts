import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { transform } from "https://esm.sh/sucrase@3.35.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProjectFile = { path: string; content: string };
type CompileRequest = {
  files: ProjectFile[];
  framework: string;
  dependencies: Record<string, string>;
  entryPoint?: string;
};

/* ── Transpile a single file ── */
function transpileFile(file: ProjectFile): { code: string; error?: string } {
  const ext = file.path.match(/\.(tsx?|jsx?)$/)?.[1] || "";
  if (!ext && !file.path.endsWith(".js")) return { code: file.content };

  const transforms: Array<"typescript" | "jsx"> = [];
  if (ext === "tsx" || ext === "ts") transforms.push("typescript");
  if (ext === "tsx" || ext === "jsx") transforms.push("jsx");
  if (transforms.length === 0) return { code: file.content };

  try {
    const result = transform(file.content, {
      transforms,
      jsxRuntime: "classic",
      production: false,
      filePath: file.path,
    });
    return { code: result.code };
  } catch (err: any) {
    return { code: "", error: `${file.path}: ${err.message}` };
  }
}

/* ── Extract all exported names from ORIGINAL source ── */
function extractExports(code: string): { defaultExport: string | null; namedExports: string[] } {
  let defaultExport: string | null = null;
  const namedExports: string[] = [];

  // export default function Foo / export default class Foo
  let m = code.match(/export\s+default\s+(?:function|class)\s+(\w+)/);
  if (m) defaultExport = m[1];

  // export default Foo (standalone)
  if (!defaultExport) {
    m = code.match(/export\s+default\s+(\w+)\s*;/);
    if (m) defaultExport = m[1];
  }

  // If no named default, look for the main component/function name
  if (!defaultExport) {
    // Check for `const Foo = ...` followed by `export default Foo` or just `export default`
    const funcMatch = code.match(/(?:const|function|class)\s+([A-Z]\w*)/);
    if (funcMatch && code.includes("export default")) {
      defaultExport = funcMatch[1];
    }
  }

  // Named exports: export const/let/var/function/class Name
  const namedPattern = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let nm;
  while ((nm = namedPattern.exec(code)) !== null) {
    namedExports.push(nm[1]);
  }

  return { defaultExport, namedExports };
}

/* ── Strip imports and exports for inline execution ── */
function stripForInline(code: string): string {
  let result = code;
  // Remove all import statements (use non-multiline to catch mid-line imports from sucrase)
  result = result.replace(/import\s+[\w{},*\s]+\s+from\s+['"][^'"]*['"];?\s*/g, "");
  result = result.replace(/import\s+['"][^'"]*['"];?\s*/g, "");
  result = result.replace(/import\s+type\s+[^;]*;?\s*/g, "");
  // Remove export default (keep declaration)
  result = result.replace(/export\s+default\s+/g, "");
  // Remove named export keyword (keep declaration)  
  result = result.replace(/export\s+(?=(?:const|let|var|function|class)\s)/g, "");
  // Remove standalone export { ... }
  result = result.replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
  return result.trim();
}

/* ── Resolve import path to a file ── */
function resolveImport(importPath: string, files: ProjectFile[]): ProjectFile | null {
  // Normalize: remove leading ./ or src/
  let normalized = importPath.replace(/^\.\//, "").replace(/^src\//, "");
  
  // Try exact match first, then with extensions
  const candidates = [
    normalized,
    `src/${normalized}`,
    `${normalized}.tsx`,
    `${normalized}.ts`,
    `${normalized}.jsx`,
    `${normalized}.js`,
    `src/${normalized}.tsx`,
    `src/${normalized}.ts`,
    `src/${normalized}.jsx`,
    `src/${normalized}.js`,
    `${normalized}/index.tsx`,
    `${normalized}/index.ts`,
    `src/${normalized}/index.tsx`,
    `src/${normalized}/index.ts`,
  ];

  for (const candidate of candidates) {
    const found = files.find(f => f.path === candidate);
    if (found) return found;
  }
  return null;
}

/* ── Parse imports from a file to build dependency graph ── */
function parseImports(code: string): Array<{ defaultImport: string | null; namedImports: string[]; path: string }> {
  const imports: Array<{ defaultImport: string | null; namedImports: string[]; path: string }> = [];
  
  // import Default from './path'
  // import { Named1, Named2 } from './path'
  // import Default, { Named } from './path'
  const importRegex = /^import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm;
  let m;
  while ((m = importRegex.exec(code)) !== null) {
    const defaultImport = m[1] || null;
    const namedImports = m[2] ? m[2].split(",").map(s => s.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean) : [];
    const path = m[3];
    // Only process local imports (starting with . or src/)
    if (path.startsWith(".") || path.startsWith("src/")) {
      imports.push({ defaultImport, namedImports, path });
    }
  }
  return imports;
}

/* ── Build import map for CDN deps ── */
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

/* ── Console capture injection ── */
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
  };
  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason?.stack || e.reason?.message || String(e.reason);
    relay('error', [msg]);
  });
})();
<\/script>`;
}

/* ── Find entry point ── */
function findEntryPoint(files: ProjectFile[], framework: string, hint?: string): string | null {
  // Vanilla projects can use HTML/JS directly
  if (framework === "vanilla-html") {
    if (hint) {
      const found = files.find(f => f.path === hint || f.path.endsWith(hint));
      if (found) return found.path;
    }
    for (const e of ["index.html", "src/index.html", "main.js", "script.js"]) {
      if (files.find(f => f.path === e)) return e;
    }
    return files.find(f => /\.(html|js|ts)$/.test(f.path))?.path || null;
  }

  // For React/TSX projects: never treat index.html as app entry.
  if (hint && /\.(tsx?|jsx?)$/.test(hint)) {
    const found = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (found) return found.path;
  }

  // If hint points to HTML, try extracting the module script src as actual entry (e.g. /src/main.tsx)
  if (hint && hint.endsWith(".html")) {
    const html = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (html) {
      const m = html.content.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i);
      if (m?.[1]) {
        const src = m[1].replace(/^\//, "");
        const fromHtml = files.find(f => f.path === src || f.path.endsWith(src));
        if (fromHtml && /\.(tsx?|jsx?)$/.test(fromHtml.path)) return fromHtml.path;
      }
    }
  }

  const entries = [
    "src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx",
    "src/main.tsx", "src/main.jsx", "main.tsx", "main.jsx",
    "src/index.tsx", "src/index.jsx", "index.tsx", "index.jsx",
  ];

  for (const entry of entries) {
    if (files.find(f => f.path === entry)) return entry;
  }

  return files.find(f => /\.(tsx?|jsx?)$/.test(f.path))?.path || null;
}

/* ── Topological sort of modules ── */
function topoSort(
  entryPath: string,
  files: ProjectFile[],
): { sorted: ProjectFile[]; appFile: ProjectFile | null } {
  const visited = new Set<string>();
  const sorted: ProjectFile[] = [];
  let appFile: ProjectFile | null = null;

  function visit(filePath: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    
    const file = files.find(f => f.path === filePath);
    if (!file) return;

    // Parse imports and visit dependencies first
    const imports = parseImports(file.content);
    for (const imp of imports) {
      const resolved = resolveImport(imp.path, files);
      if (resolved) visit(resolved.path);
    }

    if (filePath === entryPath) {
      appFile = file;
    } else {
      sorted.push(file);
    }
  }

  visit(entryPath);
  
  // Add any remaining module files not reached by imports
  for (const f of files) {
    if (/\.(tsx?|jsx?)$/.test(f.path) && !visited.has(f.path) && !f.path.includes("main.")) {
      sorted.push(f);
    }
  }

  return { sorted, appFile };
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
      
      const transpiledJS: string[] = [];
      const warnings: string[] = [];
      for (const js of jsFiles) {
        const result = transpileFile(js);
        if (result.error) {
          warnings.push(`Skipped ${js.path}: ${result.error}`);
          transpiledJS.push(`/* error in ${js.path} */`);
        } else {
          transpiledJS.push(stripForInline(result.code));
        }
      }

      const cssContent = cssFiles.map(f => f.content).join("\n");
      let html: string;

      if (htmlFile) {
        html = htmlFile.content;
        for (const css of cssFiles) {
          const pat = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${css.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, "gi");
          html = html.replace(pat, `<style>${css.content}</style>`);
        }
        for (let i = 0; i < jsFiles.length; i++) {
          const js = jsFiles[i];
          const pat = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${js.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, "gi");
          html = html.replace(pat, `<script>${transpiledJS[i]}<\/script>`);
        }
        if (!html.includes("<style>") && cssContent) {
          html = html.replace("</head>", `<style>${cssContent}</style>\n</head>`);
        }
      } else {
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script><style>${cssContent}</style></head><body><script>${transpiledJS.join("\n")}<\/script></body></html>`;
      }

      if (html.includes("</head>")) {
        html = html.replace("</head>", injectConsoleCapture() + "\n</head>");
      } else {
        html += injectConsoleCapture();
      }

      return new Response(
        JSON.stringify({ success: true, html, compiledFiles: files.length, bundleSize: html.length, warnings }),
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
    const warnings: string[] = [];

    // Topologically sort modules so dependencies come before dependents
    const { sorted: depModules, appFile } = topoSort(entry, files);

    // Transpile and build each module, exposing exports as global variables
    const moduleBlocks: string[] = [];

    for (const file of depModules) {
      const result = transpileFile(file);
      if (result.error) {
        warnings.push(`Skipped ${file.path}: ${result.error}`);
        continue;
      }

      const stripped = stripForInline(result.code);
      const exports = extractExports(file.content);
      
      // Collect all names to expose
      const allNames = [...exports.namedExports];
      if (exports.defaultExport && !allNames.includes(exports.defaultExport)) {
        allNames.push(exports.defaultExport);
      }

      // Wrap in IIFE, extract names to global scope
      const returnObj = allNames.length > 0 
        ? `return { ${allNames.join(", ")} };`
        : "return {};";

      moduleBlocks.push(`
// ── ${file.path} ──
var __mod_result = (function() {
  try {
    ${stripped}
    ${returnObj}
  } catch(e) {
    console.warn("Module ${file.path} error:", e.message);
    return {};
  }
})();
${allNames.map(name => `var ${name} = __mod_result.${name};`).join("\n")}
`);
    }

    // Transpile app entry
    let appCode = "";
    if (appFile) {
      const result = transpileFile(appFile);
      if (result.error) {
        warnings.push(`App entry error: ${result.error}`);
        appCode = "function App() { return React.createElement('div', {style:{padding:'2rem',textAlign:'center'}}, 'Compilation error in App'); }";
      } else {
        appCode = stripForInline(result.code);
      }
    } else {
      appCode = "function App() { return React.createElement('div', {style:{padding:'2rem',textAlign:'center'}}, 'No App component found'); }";
    }

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
  ${injectConsoleCapture()}
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React, { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext, useReducer, forwardRef, memo, Fragment, Suspense, lazy } from 'react';
    import { createRoot } from 'react-dom/client';

    // Make React available globally for JSX
    window.React = React;

    // Import router (may not be used, wrapped in try)
    let HashRouter, BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useLocation, Navigate, Outlet, useSearchParams;
    try {
      const router = await import('react-router-dom');
      HashRouter = router.HashRouter;
      BrowserRouter = router.BrowserRouter;
      Routes = router.Routes;
      Route = router.Route;
      Link = router.Link;
      NavLink = router.NavLink;
      useNavigate = router.useNavigate;
      useParams = router.useParams;
      useLocation = router.useLocation;
      Navigate = router.Navigate;
      Outlet = router.Outlet;
      useSearchParams = router.useSearchParams;
    } catch(e) {
      console.warn("react-router-dom not available:", e.message);
    }

    // ── Dependency modules (topological order) ──
    ${moduleBlocks.join("\n")}

    // ── App entry ──
    ${appCode}

    const AppComponent = typeof App !== 'undefined' ? App :
                         (() => React.createElement('div', {style:{padding:'2rem',textAlign:'center',fontFamily:'system-ui'}},
                           React.createElement('h2', null, 'No App component found')));

    try {
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(AppComponent));
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<div style="padding:2rem;color:#f38ba8;font-family:monospace"><h3>Render Error</h3><pre>' +
        (err.stack || err.message).replace(/</g,'&lt;') + '</pre></div>';
      console.error('Render failed:', err);
    }
  <\/script>
</body>
</html>`;

    return new Response(
      JSON.stringify({
        success: true,
        html,
        compiledFiles: depModules.length + 1,
        bundleSize: html.length,
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
