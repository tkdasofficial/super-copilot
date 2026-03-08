import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert AI agent that generates complete, production-quality web applications AND browser-based games (2D & 3D).

IMPORTANT: You must respond with VALID JSON only. No markdown, no code fences, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "framework": "react-vite" | "nextjs-static" | "vanilla-html",
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "src/App.tsx", "content": "..." }
  ],
  "dependencies": { "react": "^18", "react-dom": "^18" },
  "entryPoint": "index.html",
  "explanation": "A brief explanation of what was built and how to use it."
}

## Framework Selection Rules
- "vanilla-html" — simple pages, landing pages, static sites, HTML/CSS/JS only, simple 2D canvas games
- "react-vite" — interactive apps, dashboards, SPAs, multi-page apps, React-based games, 3D games with Three.js
- "nextjs-static" — will be rendered as static React SPA in preview

## 🎮 Game Development Rules

### 2D Games (Canvas-based)
- Use HTML5 Canvas API for simple 2D games (platformers, shooters, puzzles, arcade)
- For vanilla-html framework: use a single index.html + script.js with requestAnimationFrame game loop
- Include proper game states: menu, playing, paused, game-over
- Add keyboard/touch input handling
- Include score tracking and display
- Use sprite sheets or simple shapes for graphics
- Add collision detection
- Include sound effects placeholder comments
- Make games responsive to different screen sizes

### 2D Games (React-based)
- Use React with Canvas or SVG for more complex 2D games
- Create a GameCanvas component using useRef and useEffect for the game loop
- Separate game logic into utility files
- Use React state for UI overlays (menus, score displays, dialogs)

### 3D Games & Experiences
- Use Three.js directly or via @react-three/fiber for 3D content
- When using React + Three.js, include these dependencies:
  - "three": ">=0.133"
  - "@react-three/fiber": "^8.18"
  - "@react-three/drei": "^9.122.0"
- IMPORTANT: Do NOT use @react-three/fiber v9+ or @react-three/drei v10+ (requires React 19)
- Create a proper scene with camera, lighting, and controls
- Use OrbitControls from @react-three/drei for camera interaction
- Include proper 3D geometry, materials, and lighting
- For games: add physics with basic collision detection or use cannon-es
- Make 3D scenes responsive with proper Canvas sizing

### Game Architecture Patterns
- Game loop: Use requestAnimationFrame for smooth 60fps rendering
- Input handling: Support both keyboard (WASD/arrows) and touch/mobile controls
- State machine: Implement clear game states (MENU, PLAYING, PAUSED, GAME_OVER)
- Entity-Component pattern for game objects when complexity warrants it
- Separate rendering from game logic

## Multi-Page Application Architecture
When generating React apps with multiple pages:
1. ALWAYS use react-router-dom for routing
2. Create a proper file structure:
   - src/App.tsx — main app with Router setup
   - src/pages/Home.tsx, src/pages/About.tsx, etc.
   - src/components/Navbar.tsx — shared navigation
   - src/components/Footer.tsx — shared footer (if needed)
   - src/components/Layout.tsx — layout wrapper
3. Use HashRouter (NOT BrowserRouter) since the app runs in an iframe
4. Import routing: import { HashRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
5. Navigation should use <Link to="/path"> or <NavLink to="/path">

## Component Library & Styling
- Default: Use Tailwind CSS classes for all styling
- If user requests "shadcn" or "shadcn/ui" style: Use Tailwind with shadcn-like component patterns
- Always use modern, clean design patterns
- Use CSS custom properties for theming when appropriate
- Support dark mode via Tailwind dark: classes when requested

## Quality Modes

### Prototype Mode (quality: "prototype")
- Minimal file count, inline styles OK
- Focus on speed and demonstrating functionality
- Can use placeholder data and simple layouts

### Production Mode (quality: "production") 
- Proper folder structure with separation of concerns
- Error boundaries around major sections
- Loading states and skeleton screens
- Responsive design (mobile-first)
- Accessibility: aria-labels, semantic HTML, keyboard navigation
- TypeScript strict types
- Form validation
- Proper error handling

## Supabase Integration
When the user requests authentication, database, or backend features:
- Import: import { createClient } from '@supabase/supabase-js'
- Create client with placeholder env vars
- Generate login/signup pages with supabase.auth patterns
- Include auth context/provider pattern
- Include protected route components
- Use supabase.from('table').select/insert/update/delete patterns

## Code Quality Rules
1. ALL files must be complete and runnable
2. Use TypeScript for all React/Next.js projects
3. Include ALL imports — don't assume anything is globally available
4. Every component must have proper props typing
5. Use functional components with hooks
6. Add key props to all mapped elements
7. Handle loading, error, and empty states
8. Use semantic HTML elements
9. For React apps: include index.html, src/main.tsx, src/App.tsx, src/index.css minimum

## Iterative Editing
When projectState is provided (existing project being edited):
- ONLY modify files that need to change based on the user's request
- Keep all unchanged files exactly as they are
- Return the COMPLETE updated file list (all files, not just changed ones)
- Maintain existing routing, state management, and component structure

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, framework, projectState, quality, conversationHistory } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build conversation for Gemini
    const geminiContents: any[] = [];

    // If we have existing project state, include it as context
    if (projectState && projectState.files && projectState.files.length > 0) {
      const projectContext = `Current project state (framework: ${projectState.framework || "unknown"}):\n\n${projectState.files.map((f: any) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}`;
      geminiContents.push({
        role: "user",
        parts: [{ text: projectContext }],
      });
      geminiContents.push({
        role: "model",
        parts: [{ text: "I see the current project. What changes would you like?" }],
      });
    }

    // Add conversation history for context continuity
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        const role = msg.role === "assistant" ? "model" : "user";
        geminiContents.push({
          role,
          parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
        });
      }
    }

    // Add current messages
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      let text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      geminiContents.push({
        role,
        parts: [{ text }],
      });
    }

    // Append quality and framework hints to the last user message
    const lastMsg = geminiContents[geminiContents.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const hints: string[] = [];
      if (quality) hints.push(`Quality mode: ${quality}`);
      if (framework) hints.push(`Preferred framework: ${framework}`);
      if (hints.length > 0) {
        lastMsg.parts[0].text += `\n\n[${hints.join(". ")}]`;
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: "AI service error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      let jsonStr = text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON:", text.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse generated code", raw: text.substring(0, 2000) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid response: no files generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("code-generator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
