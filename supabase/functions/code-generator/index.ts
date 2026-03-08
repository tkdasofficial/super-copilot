import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert full-stack web developer AI that generates complete, production-quality web applications.

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
- "vanilla-html" — simple pages, landing pages, static sites, HTML/CSS/JS only
- "react-vite" — interactive apps, dashboards, SPAs, multi-page apps with routing
- "nextjs-static" — will be rendered as static React SPA in preview

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
- If user requests "shadcn" or "shadcn/ui" style: Use Tailwind with shadcn-like component patterns (rounded-lg borders, ring focus states, slate/zinc color palette, cn() utility)
- If user requests "Material" style: Use clean Material Design patterns with Tailwind (elevated cards, filled buttons, Inter/Roboto font, surface colors)
- Always use modern, clean design patterns
- Use CSS custom properties for theming when appropriate
- Support dark mode via Tailwind dark: classes when requested

## Quality Modes
The request may include a quality mode indicator:

### Prototype Mode (quality: "prototype")
- Minimal file count, inline styles OK
- Focus on speed and demonstrating functionality
- Can use placeholder data and simple layouts
- Skip error boundaries, loading states, meta tags

### Production Mode (quality: "production") 
- Proper folder structure with separation of concerns
- Error boundaries around major sections
- Loading states and skeleton screens
- Responsive design (mobile-first)
- Accessibility: aria-labels, semantic HTML, keyboard navigation
- Meta tags, proper <title>, viewport
- TypeScript strict types
- Form validation
- Proper error handling with user-friendly messages

## Supabase Integration
When the user requests authentication, database, or backend features:

### Authentication
- Import: import { createClient } from '@supabase/supabase-js'
- Create client with placeholder env vars:
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL',
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
  )
- Generate login/signup pages with supabase.auth.signInWithPassword, signUp, signOut
- Include auth context/provider pattern
- Include protected route components

### Database CRUD
- Use supabase.from('table').select/insert/update/delete patterns
- Include TypeScript types for table schemas
- Add loading and error states for all queries
- Comment where RLS policies would be needed

### Storage
- Use supabase.storage.from('bucket').upload/download/getPublicUrl
- Include file upload components with drag-and-drop

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
- Add new pages/components without breaking existing ones

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
