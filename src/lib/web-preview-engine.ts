export type GeneratedFile = {
  path: string;
  content: string;
};

export type WebAppProject = {
  framework: "react-vite" | "nextjs-static" | "vanilla-html";
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  entryPoint: string;
  explanation: string;
};

/**
 * Build a complete HTML string that can be used as iframe srcdoc
 * to preview a generated web app.
 */
export function buildPreviewHTML(
  files: GeneratedFile[],
  framework: string,
  dependencies: Record<string, string> = {}
): string {
  switch (framework) {
    case "react-vite":
    case "nextjs-static":
      return buildReactPreview(files, dependencies);
    case "vanilla-html":
    default:
      return buildVanillaPreview(files);
  }
}

function buildVanillaPreview(files: GeneratedFile[]): string {
  // Find the main HTML file
  const htmlFile = files.find(
    (f) => f.path === "index.html" || f.path.endsWith("/index.html")
  );

  if (htmlFile) {
    let html = htmlFile.content;

    // Inline CSS files referenced in the HTML
    const cssFiles = files.filter((f) => f.path.endsWith(".css"));
    for (const css of cssFiles) {
      // Replace <link> references with inline styles
      const linkPattern = new RegExp(
        `<link[^>]*href=[\\\"'](?:\\\\./)?${escapeRegex(css.path)}[\\\"'][^>]*>`,
        "gi"
      );
      html = html.replace(linkPattern, `<style>${css.content}</style>`);
    }

    // Inline JS files referenced in the HTML
    const jsFiles = files.filter(
      (f) => f.path.endsWith(".js") || f.path.endsWith(".ts")
    );
    for (const js of jsFiles) {
      const scriptPattern = new RegExp(
        `<script[^>]*src=[\\\"'](?:\\\\./)?${escapeRegex(js.path)}[\\\"'][^>]*>\\\\s*</script>`,
        "gi"
      );
      html = html.replace(
        scriptPattern,
        `<script>${js.content}</script>`
      );
    }

    // If CSS/JS files weren't linked, append them
    if (!html.includes("<style>") && cssFiles.length > 0) {
      const styles = cssFiles.map((f) => `<style>${f.content}</style>`).join("\n");
      html = html.replace("</head>", `${styles}\n</head>`);
    }

    if (jsFiles.length > 0) {
      const unlinkedJS = jsFiles.filter(
        (f) => !html.includes(f.content)
      );
      if (unlinkedJS.length > 0) {
        const scripts = unlinkedJS
          .map((f) => `<script>${f.content}</script>`)
          .join("\n");
        html = html.replace("</body>", `${scripts}\n</body>`);
      }
    }

    return html;
  }

  // No HTML file — build one from CSS and JS
  const cssContent = files
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
  const jsContent = files
    .filter((f) => f.path.endsWith(".js") || f.path.endsWith(".ts"))
    .map((f) => f.content)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${cssContent}</style>
</head>
<body>
  <script>${jsContent}</script>
</body>
</html>`;
}

function buildReactPreview(
  files: GeneratedFile[],
  dependencies: Record<string, string>
): string {
  // Find key React files
  const appFile = files.find(
    (f) =>
      f.path === "src/App.tsx" ||
      f.path === "src/App.jsx" ||
      f.path === "App.tsx" ||
      f.path === "App.jsx"
  );

  const cssFiles = files.filter((f) => f.path.endsWith(".css"));
  const allStyles = cssFiles.map((f) => f.content).join("\n");

  // Build import map for dependencies
  const importMap: Record<string, string> = {
    react: "https://esm.sh/react@18?dev",
    "react-dom": "https://esm.sh/react-dom@18?dev",
    "react-dom/client": "https://esm.sh/react-dom@18/client?dev",
    "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime?dev",
  };

  // Add user dependencies
  for (const [pkg, version] of Object.entries(dependencies)) {
    if (!importMap[pkg]) {
      const ver = version.replace(/[\^~]/, "");
      importMap[pkg] = `https://esm.sh/${pkg}@${ver}`;
    }
  }

  // Collect all component/module files (non-CSS, non-HTML)
  const moduleFiles = files.filter(
    (f) =>
      !f.path.endsWith(".css") &&
      !f.path.endsWith(".html") &&
      !f.path.endsWith(".json") &&
      !f.path.endsWith(".md")
  );

  // Transform TSX/JSX to work in browser by stripping types and converting JSX
  // We use a simple approach: wrap in a module script with importmap
  let appCode = appFile?.content || "";

  // Strip TypeScript-specific syntax for browser compatibility
  appCode = stripTypeScript(appCode);

  // Build inline modules for additional component files
  const additionalModules = moduleFiles
    .filter((f) => f !== appFile && !f.path.includes("main."))
    .map((f) => {
      const moduleName = f.path
        .replace(/^src\//, "")
        .replace(/\.(tsx?|jsx?)$/, "");
      const code = stripTypeScript(f.content);
      return { name: moduleName, code };
    });

  // Add additional modules to import map as blob URLs (handled via inline scripts)
  const moduleScripts = additionalModules
    .map(
      (m) =>
        `<script type="module" data-module="${m.name}">${m.code}</script>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
  ${JSON.stringify({ imports: importMap }, null, 2)}
  </script>
  <style>${allStyles}</style>
</head>
<body>
  <div id="root"></div>
  ${moduleScripts}
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';

    ${appCode}

    // Try to find the default export
    const AppComponent = typeof App !== 'undefined' ? App : 
                         typeof Default !== 'undefined' ? Default : 
                         () => React.createElement('div', null, 'No App component found');

    const root = createRoot(document.getElementById('root'));
    root.render(React.createElement(AppComponent));
  </script>
</body>
</html>`;
}

/**
 * Strip TypeScript-specific syntax so code runs in the browser.
 * This is a lightweight transform — not a full TS compiler.
 */
function stripTypeScript(code: string): string {
  let result = code;

  // Remove import statements (they're handled via importmap or inlined)
  result = result.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "");
  result = result.replace(/^import\s+['"].*?['"];?\s*$/gm, "");

  // Remove export default — keep the declaration
  result = result.replace(/^export\s+default\s+/gm, "");

  // Remove named exports
  result = result.replace(/^export\s+(?=(?:const|let|var|function|class|type|interface|enum))/gm, "");

  // Remove type/interface declarations
  result = result.replace(/^(?:export\s+)?(?:type|interface)\s+\w+[\s\S]*?(?=\n(?:const|let|var|function|class|export|import|\/\/|\n|$))/gm, "");

  // Remove type annotations from variables: const x: Type = ...
  result = result.replace(/:\\s*(?:string|number|boolean|any|void|null|undefined|never|unknown|React\.\w+(?:<[^>]*>)?|\w+(?:<[^>]*>)?(?:\[\])?)\s*(?=[=,;\)\]\}])/g, "");

  // Remove generic type parameters from function calls
  result = result.replace(/<(?:string|number|boolean|any|void|null|undefined|never|unknown|\w+)(?:\[\])?>/g, "");

  // Remove "as Type" assertions
  result = result.replace(/\s+as\s+\w+(?:<[^>]*>)?/g, "");

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
