import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
  "script-writer": `You are an expert AI Script Writer for video creators. You specialize in writing engaging, retention-optimized scripts for YouTube videos, shorts, stories, and other platforms. Structure your scripts with clear sections: HOOK, INTRO, BODY (with numbered points or segments), CTA, and OUTRO. Include timing markers. Focus on viewer retention hooks, pattern interrupts, and engagement triggers.`,
  "thumbnail-designer": `You are an expert AI Thumbnail Designer. You create detailed thumbnail concepts optimized for maximum click-through rate (CTR). Provide: 1) Visual composition description, 2) Text overlay suggestions (keep it 3-5 words max), 3) Color palette recommendations, 4) Facial expression/emotion guidance, 5) Contrast and readability tips.`,
  "seo-optimizer": `You are an expert AI SEO Optimizer for video and content platforms. You generate optimized titles, descriptions, tags, and keywords. Provide: 1) SEO-optimized title options (under 60 chars), 2) Full video description with timestamps and keywords, 3) Relevant tags and keywords list, 4) Hashtag suggestions, 5) Search ranking tips.`,
  "image-generator": `You are an expert AI Image Creator assistant. When users request images, create highly detailed, optimized prompts for image generation. Describe: subject, composition, lighting, color palette, style, mood, camera angle, and technical details.`,
  "content-optimizer": `You are a comprehensive Content Optimizer AI. You provide full content packages including: script outlines, SEO optimization, thumbnail concepts, tag strategies, and growth recommendations.`,
  "content-analyzer": `You are an expert Content Analyzer AI. You analyze existing content and provide specific, actionable improvement suggestions. Focus on: retention analysis, CTR optimization, SEO strength, audience engagement, and competitive positioning.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are Super Copilot, a powerful AI assistant for content creators. You help with brainstorming, writing, strategy, analysis, and creative tasks. Be helpful, concise, and actionable. Format responses clearly with structured sections when appropriate.`;

const WEB_ANALYSIS_SYSTEM_PROMPT = `You are Super Copilot with web analysis capabilities. When a user provides a URL or asks about a website, use your Google Search grounding capabilities to find real, up-to-date information about that website.

Your analysis should include (when publicly available):
1. **Website Overview** — What the site is about, its purpose, and owner/company
2. **Key Features & Content** — Main offerings, services, or content available
3. **Technology Stack** — Any known technologies, frameworks, or platforms used
4. **Traffic & Popularity** — Known rankings, traffic estimates, or popularity metrics
5. **Reputation & Reviews** — Public sentiment, reviews, or notable mentions
6. **Social Presence** — Social media links, follower counts if known
7. **SEO & Domain Info** — Domain age, authority indicators if available

If the website requires authentication or login to view content, clearly state:
"⚠️ **Authentication Required** — This website requires login/authentication to access its content. The details shown are based on publicly available information only. To view protected content, you would need valid credentials or an authorized account."

If information is limited, explain what data is publicly available and what requires authentication. Always be honest about what you can and cannot access. Use grounded, factual data from Google Search — never fabricate details.`;

// Detect URLs in message content
function containsUrl(text: string): boolean {
  return /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i.test(text) ||
    /(?:^|\s)(www\.[^\s<>"{}|\\^`\[\]]+)/i.test(text);
}

// Detect if user is asking to analyze/check a website
function isWebAnalysisRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const hasUrl = containsUrl(text);
  if (!hasUrl) return false;

  // Check for analysis intent keywords
  const hasAnalysisIntent = /\b(analy[sz]e|check|review|inspect|scan|audit|examine|tell\s*me\s*about|what\s*is|details?\s*(about|of|on)|info(rmation)?\s*(about|of|on)|describe|explain|overview|look\s*at|visit|open|show\s*me|go\s*to|about\s*this|what.*website|website.*what)\b/i.test(lower);

  // If there's a URL and analysis intent, or just a URL with minimal other text
  if (hasAnalysisIntent) return true;

  // If the message is mostly just a URL (short message with URL)
  const urlRemoved = text.replace(/https?:\/\/[^\s]+/g, "").replace(/www\.[^\s]+/g, "").trim();
  if (urlRemoved.length < 30 && hasUrl) return true;

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, toolId, webAnalysis } = await req.json();

    // Gather all API keys for fallback
    const geminiKeys: string[] = [];
    for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
      const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
      if (k) geminiKeys.push(k);
    }
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (geminiKeys.length === 0 && !GROQ_API_KEY) {
      throw new Error("No AI API keys configured");
    }

    // Determine if this is a web analysis request
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const lastUserText = typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : (Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
        : "");

    const isWebAnalysis = webAnalysis === true || isWebAnalysisRequest(lastUserText);

    const systemPrompt = isWebAnalysis
      ? WEB_ANALYSIS_SYSTEM_PROMPT
      : (toolId && TOOL_SYSTEM_PROMPTS[toolId]
        ? TOOL_SYSTEM_PROMPTS[toolId]
        : DEFAULT_SYSTEM_PROMPT);

    // Convert OpenAI-style messages to Gemini format
    const geminiContents: any[] = [];

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";

      if (typeof msg.content === "string") {
        geminiContents.push({
          role,
          parts: [{ text: msg.content }],
        });
      } else if (Array.isArray(msg.content)) {
        const parts: any[] = [];
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push({ text: part.text });
          } else if (part.type === "image_url" && part.image_url?.url) {
            const url = part.image_url.url;
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
              }
            }
          }
        }
        geminiContents.push({ role, parts });
      }
    }

    // Build request body — add Google Search grounding for web analysis
    const geminiBody: any = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
    };

    if (isWebAnalysis) {
      // Enable Google Search grounding for real-time web data
      geminiBody.tools = [{ google_search: {} }];
    }

    // Try each Gemini key, then fall back to Groq
    let response: Response | null = null;
    let lastError = "";

    for (const key of geminiKeys) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          }
        );
        if (r.ok) { response = r; break; }
        lastError = await r.text();
        console.warn(`Gemini key failed (${r.status}):`, lastError.slice(0, 200));
        if (r.status !== 429 && r.status !== 503 && r.status !== 500) {
          // Non-retryable error
          response = r; break;
        }
      } catch (e) {
        console.warn("Gemini fetch error:", e);
        lastError = String(e);
      }
    }

    // Groq fallback (non-streaming, converted to SSE) — skip for web analysis (no grounding support)
    if (!response?.ok && GROQ_API_KEY && !isWebAnalysis) {
      console.log("All Gemini keys exhausted, falling back to Groq");
      try {
        const groqMessages = [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content :
              (Array.isArray(m.content) ? m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") : ""),
          })),
        ];
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: groqMessages,
            stream: true,
          }),
        });
        if (groqResp.ok) {
          // Groq returns OpenAI-compatible SSE, pass through directly
          return new Response(groqResp.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        lastError = await groqResp.text();
        console.error("Groq fallback failed:", groqResp.status, lastError.slice(0, 200));
      } catch (e) {
        console.error("Groq fetch error:", e);
      }
    }

    if (!response?.ok) {
      return new Response(
        JSON.stringify({ error: "All AI providers failed", details: lastError.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              // Extract text from all parts (grounding responses may have multiple parts)
              const parts = parsed.candidates?.[0]?.content?.parts;
              if (parts) {
                let textContent = "";
                for (const part of parts) {
                  if (part.text) {
                    textContent += part.text;
                  }
                }
                if (textContent) {
                  const chunk = {
                    choices: [{ delta: { content: textContent } }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
            } catch {
              // partial JSON, skip
            }
          }
        }

        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
