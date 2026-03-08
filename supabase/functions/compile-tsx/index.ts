import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.20.2/wasm.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let esbuildInitialized = false;

async function ensureEsbuild() {
  if (!esbuildInitialized) {
    await esbuild.initialize({
      wasmURL: "https://unpkg.com/esbuild-wasm@0.20.2/esbuild.wasm",
    });
    esbuildInitialized = true;
  }
}

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
 * Virtual filesystem plugin for esbuild.
 * Resolves internal project imports from the provided files array.
 */
function virtualFsPlugin(files: ProjectFile[]): esbuild.Plugin {
  const fileMap = new Map<string, string>();

  // Build lookup map with normalized paths
  for (const f of files) {
    const normalized = f.path.replace(/^\.\//, "").replace(/^src\//, "");
    fileMap.set(f.path, f.content);
    fileMap.set(normalized, f.content);
    // Also store without extension
    const noExt = normalized.replace(/\.(tsx?|jsx?)$/, "");
    fileMap.set(noExt, f.content);
  }

  return {
    name: "virtual-fs",
    setup(build) {
      // Resolve external npm packages
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        // Skip node_modules-style imports — mark as external
        return { path: args.path, external: true };
      });

      // Resolve relative imports
      build.onResolve({ filter: /^\./ }, (args) => {
        const dir = args.importer
          ? args.importer.replace(/\/[^/]+$/, "")
          : "";
        
        const candidates = [
          `${dir}/${args.path}`.replace(/^\//, ""),
          `${dir}/${args.path}.tsx`.replace(/^\//, ""),
          `${dir}/${args.path}.ts`.replace(/^\//, ""),
          `${dir}/${args.path}.jsx`.replace(/^\//, ""),
          `${dir}/${args.path}.js`.replace(/^\//, ""),
          `${dir}/${args.path}/index.tsx`.replace(/^\//, ""),
          `${dir}/${args.path}/index.ts`.replace(/^\//, ""),
          args.path.replace(/^\.\//, ""),
          args.path.replace(/^\.\//, "") + ".tsx",
          args.path.replace(/^\.\//, "") + ".ts",
          args.path.replace(/^\.\//, "") + ".jsx",
          args.path.replace(/^\.\//, "") + ".js",
        ];

        for (const c of candidates) {
          if (fileMap.has(c)) {
            return { path: c, namespace: "virtual" };
          }
        }

        // Try without src/ prefix
        for (const c of candidates) {
          const withoutSrc = c.replace(/^src\//, "");
          if (fileMap.has(withoutSrc)) {
            return { path: withoutSrc, namespace: "virtual" };
          }
        }

        return { path: args.path, external: true };
      });

      // Load virtual files
      build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
        const content = fileMap.get(args.path);
        if (content !== undefined) {
          const ext = args.path.match(/\.(tsx?|jsx?)$/)?.[1] || "tsx";
          const loader = ext === "tsx" || ext === "jsx" ? "tsx" :
                         ext === "ts" ? "ts" : "js";
          return { contents: content, loader: loader as esbuild.Loader };
        }
        return null;
      });
    },
  };
}

/**
 * Find the entry point file from the project files.
 */
function findEntryPoint(files: ProjectFile[], framework: string, hint?: string): string | null {
  if (hint) {
    const found = files.find(f => f.path === hint || f.path.endsWith(hint));
    if (found) return found.path;
  }

  // React projects: look for App.tsx/jsx or main.tsx/jsx
  const reactEntries = [
    "src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx",
    "src/main.tsx", "src/main.jsx", "main.tsx", "main.jsx",
    "src/index.tsx", "src/index.jsx", "index.tsx", "index.jsx",
  ];

  for (const entry of reactEntries) {
    if (files.find(f => f.path === entry)) return entry;
  }

  // Vanilla: look for index.html or main.js
  if (framework === "vanilla-html") {
    const vanillaEntries = ["index.html", "src/index.html", "main.js", "src/main.js", "index.js", "script.js"];
    for (const entry of vanillaEntries) {
      if (files.find(f => f.path === entry)) return entry;
    }
  }

  // Fallback: first tsx/jsx/ts/js file
  const jsFile = files.find(f => /\.(tsx?|jsx?)$/.test(f.path));
  return jsFile?.path || null;
}

/**
 * Build import map for external dependencies.
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
 * Generate the final preview HTML from compiled code.
 */
function generatePreviewHTML(
  compiledJS: string,
  cssContent: string,
  importMap: Record<string, string>,
  framework: string,
): string {
  const importMapJSON = JSON.stringify({ imports: importMap }, null, 2);

  if (framework === "vanilla-html") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>${cssContent}</style>
</head>
<body>
  <script>${compiledJS}<\/script>
  ${injectConsoleCapture()}
</body>
</html>`;
  }

  // React-based frameworks
  return `<!DOCTYPE html>
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
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    
    ${compiledJS}
    
    // Find and render the App component
    const AppComponent = typeof App !== 'undefined' ? App :
                         typeof default_1 !== 'undefined' ? default_1 :
                         () => React.createElement('div', {
                           style: { padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }
                         }, 
                           React.createElement('h2', null, '⚠ No App component found'),
                           React.createElement('p', { style: { color: '#888' } }, 'Make sure your project exports an App component.')
                         );
    
    try {
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(AppComponent));
    } catch (err) {
      document.getElementById('root').innerHTML = 
        '<div style="padding:2rem;color:#f38ba8;font-family:monospace">' +
        '<h3>Render Error</h3><pre>' + (err.stack || err.message) + '</pre></div>';
      console.error(err);
    }
  <\/script>
  ${injectConsoleCapture()}
</body>
</html>`;
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

    // For vanilla HTML, skip esbuild — just inline everything
    if (framework === "vanilla-html") {
      const htmlFile = files.find(f => f.path.endsWith(".html"));
      const cssFiles = files.filter(f => f.path.endsWith(".css"));
      const jsFiles = files.filter(f => /\.(js|ts)$/.test(f.path));
      const cssContent = cssFiles.map(f => f.content).join("\n");
      const jsContent = jsFiles.map(f => f.content).join("\n");

      let html: string;
      if (htmlFile) {
        html = htmlFile.content;
        // Inline CSS
        for (const css of cssFiles) {
          const pat = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${css.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, "gi");
          html = html.replace(pat, `<style>${css.content}</style>`);
        }
        // Inline JS
        for (const js of jsFiles) {
          const pat = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${js.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, "gi");
          html = html.replace(pat, `<script>${js.content}<\/script>`);
        }
        // Add remaining CSS/JS if not already inlined
        if (!html.includes("<style>") && cssContent) {
          html = html.replace("</head>", `<style>${cssContent}</style>\n</head>`);
        }
      } else {
        html = generatePreviewHTML(jsContent, cssContent, {}, "vanilla-html");
      }

      return new Response(
        JSON.stringify({
          success: true,
          html: html.includes("__err") ? html : html.replace("</body>", injectConsoleCapture() + "\n</body>"),
          compiledFiles: files.length,
          bundleSize: html.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // React/Next.js compilation with esbuild
    await ensureEsbuild();

    const entry = findEntryPoint(files, framework, entryPoint);
    if (!entry) {
      return new Response(
        JSON.stringify({ error: "No entry point found. Include App.tsx, main.tsx, or index.tsx." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect CSS
    const cssContent = files
      .filter(f => f.path.endsWith(".css"))
      .map(f => f.content)
      .join("\n");

    // Build with esbuild
    const result = await esbuild.build({
      stdin: {
        contents: files.find(f => f.path === entry)!.content,
        loader: entry.endsWith(".tsx") ? "tsx" : entry.endsWith(".jsx") ? "jsx" : "ts",
        resolveDir: ".",
        sourcefile: entry,
      },
      plugins: [virtualFsPlugin(files)],
      bundle: true,
      format: "esm",
      jsx: "automatic",
      jsxImportSource: "react",
      target: "es2020",
      minify: false,
      write: false,
      external: [
        "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
        "react-router-dom",
        ...Object.keys(dependencies),
      ],
      treeShaking: true,
      logLevel: "silent",
    });

    const compiledJS = result.outputFiles?.[0]?.text || "";
    const warnings = result.warnings?.map(w => w.text) || [];
    const errors = result.errors?.map(e => e.text) || [];

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Compilation failed",
          errors,
          warnings,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const importMap = buildImportMap(dependencies);
    const html = generatePreviewHTML(compiledJS, cssContent, importMap, framework);

    return new Response(
      JSON.stringify({
        success: true,
        html,
        compiledFiles: files.length,
        bundleSize: compiledJS.length,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Compile error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal compilation error",
        stack: err.stack,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
