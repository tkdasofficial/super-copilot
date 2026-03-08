

## Full-Stack Web Application Builder Feature

### What This Feature Does

When a user selects the "Full-Stack" task mode (already exists in the UI) or describes building a web app, the AI generates complete, runnable web application code. The user gets a live preview in a sandboxed iframe, can iterate via chat, and download/export the project.

**Supported outputs**: React, Vite, Next.js (static export), vanilla HTML/CSS/JS, TypeScript — all previewed client-side via iframe sandbox.

---

### Architecture

```text
User Chat Input (fullstack mode)
        │
        ▼
┌─────────────────────────┐
│  code-generator Edge Fn │  ← Gemini with code-gen system prompt
│  Returns structured JSON│    (files array + dependencies + framework)
│  via streaming SSE      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  WebContainerCard       │  ← New React component
│  (replaces chat msg)    │
│                         │
│  ┌───────────────────┐  │
│  │ Sandboxed iframe   │  │  ← srcdoc or blob URL preview
│  │ (live preview)     │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ Code tabs/files    │  │  ← File tree + code editor view
│  │ (read-only)        │  │
│  └───────────────────┘  │
│  [Download ZIP] [Copy]  │
└─────────────────────────┘
```

---

### Implementation Plan

#### 1. New Edge Function: `code-generator`

- **File**: `supabase/functions/code-generator/index.ts`
- Accepts `{ messages, framework, projectState }` via POST
- Uses Gemini with a specialized system prompt that instructs it to return structured JSON:
  ```json
  {
    "framework": "react-vite" | "nextjs-static" | "vanilla-html",
    "files": [
      { "path": "index.html", "content": "..." },
      { "path": "src/App.tsx", "content": "..." }
    ],
    "dependencies": { "react": "^18", "tailwindcss": "^3" },
    "entryPoint": "index.html",
    "explanation": "Here's what I built..."
  }
  ```
- Streams the explanation text first, then sends the complete files JSON as a final SSE event
- For iterative edits: accepts `projectState` (current files) so Gemini can modify specific files
- Register in `supabase/config.toml`

#### 2. New Component: `WebAppPreviewCard`

- **File**: `src/components/WebAppPreviewCard.tsx`
- Renders inside chat messages (like `VideoEditorCard`)
- **Three sections**:
  - **Live Preview**: Sandboxed `<iframe>` using `srcdoc` — assembles all files into a single HTML document with inlined JS/CSS. For React apps, uses an in-browser bundler approach (inline ESM imports via esm.sh CDN)
  - **Code Viewer**: Tabbed file viewer with syntax highlighting (use `react-markdown` code blocks or a lightweight highlighter)
  - **Actions**: Download as ZIP (using JSZip), copy individual files, open in new tab
- Shows generation progress phases: "Planning architecture..." → "Writing code..." → "Building preview..."

#### 3. iframe Preview Engine

- **File**: `src/lib/web-preview-engine.ts`
- `buildPreviewHTML(files, framework, dependencies)` → returns a single HTML string
- **Vanilla HTML/CSS/JS**: Direct concatenation into srcdoc
- **React/Vite apps**: Generates an HTML shell that loads React via esm.sh CDN (`https://esm.sh/react@18`, `https://esm.sh/react-dom@18`), inlines component code as ES modules via blob URLs
- **Next.js**: Converts to static React since we can't run a Node server — extracts page components and renders them as React SPA
- Handles Tailwind CSS via CDN play script (`https://cdn.tailwindcss.com`)
- Sandboxes iframe with `sandbox="allow-scripts allow-same-origin"` for security

#### 4. ZIP Export Utility

- **File**: `src/lib/zip-export.ts`
- Uses JSZip (new dependency) to package all generated files
- Generates proper `package.json` with dependencies for React/Vite/Next.js projects
- Includes README.md with setup instructions
- Triggers browser download

#### 5. Chat Integration

- **Update `src/lib/types.ts`**: Add `webApp` field to `ChatMessage` type:
  ```ts
  webApp?: {
    files: { path: string; content: string }[];
    framework: string;
    dependencies: Record<string, string>;
    explanation: string;
  };
  ```
- **Update `src/components/ChatWorkspace.tsx`**: Detect fullstack mode or web-app-building intent via regex, route to `code-generator` edge function instead of regular chat, parse response into `webApp` message field
- **Update `src/components/ChatMessage.tsx`**: Render `WebAppPreviewCard` when `message.webApp` exists
- **Update `src/components/ChatInput.tsx`**: No changes needed (fullstack mode already exists)

#### 6. Iterative Editing

- When user sends follow-up messages in fullstack mode, pass the current `webApp.files` as `projectState` to the edge function
- Gemini modifies only the relevant files and returns the updated set
- Preview iframe refreshes automatically

#### 7. Supabase Config

- Add `[functions.code-generator]` with `verify_jwt = false` to `supabase/config.toml`
- No new database tables needed for MVP (projects saved in chat history; persistence comes later with the DB tables from the earlier plan)

---

### New Dependency

- **jszip** — for ZIP file generation and download

---

### Files to Create/Edit

| Action | File |
|--------|------|
| Create | `supabase/functions/code-generator/index.ts` |
| Create | `src/components/WebAppPreviewCard.tsx` |
| Create | `src/lib/web-preview-engine.ts` |
| Create | `src/lib/zip-export.ts` |
| Edit | `src/lib/types.ts` — add `webApp` field |
| Edit | `src/components/ChatWorkspace.tsx` — fullstack routing |
| Edit | `src/components/ChatMessage.tsx` — render WebAppPreviewCard |
| Edit | `supabase/config.toml` — register edge function |
| Edit | `package.json` — add jszip |

