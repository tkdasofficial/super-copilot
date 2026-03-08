import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert full-stack web developer AI. You generate complete, runnable web application code.

IMPORTANT: You must respond with VALID JSON only. No markdown, no code fences, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "framework": "react-vite" | "nextjs-static" | "vanilla-html",
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>..." },
    { "path": "src/App.tsx", "content": "..." }
  ],
  "dependencies": { "react": "^18", "react-dom": "^18" },
  "entryPoint": "index.html",
  "explanation": "A brief explanation of what was built and how to use it."
}

Rules:
1. Choose the framework based on what makes sense for the request:
   - "vanilla-html" for simple pages, landing pages, or when HTML/CSS/JS is sufficient
   - "react-vite" for interactive apps, dashboards, SPAs
   - "nextjs-static" for multi-page apps (will be rendered as static React)
2. Always include ALL files needed to run the project
3. For React apps: include index.html, src/main.tsx, src/App.tsx, and src/index.css at minimum
4. For vanilla HTML: include index.html with embedded or linked CSS/JS
5. Use Tailwind CSS via CDN for styling when appropriate
6. Make the code production-quality, responsive, and visually polished
7. Use TypeScript for React projects
8. Include proper imports and exports
9. The code must work standalone — no external build tools required for preview
10. For React apps, imports like "react" and "react-dom" will be resolved via esm.sh CDN in preview

When editing an existing project (projectState is provided):
- Only modify the files that need to change
- Keep all other files as-is
- Return the COMPLETE updated file list (not just changed files)

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, framework, projectState } = await req.json();
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

    // Add conversation messages
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      geminiContents.push({
        role,
        parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
      });
    }

    // Add framework hint if specified
    if (framework) {
      const lastMsg = geminiContents[geminiContents.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.parts[0].text += `\n\nPreferred framework: ${framework}`;
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

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code fences)
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

    // Validate required fields
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
