import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

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

// Extract URLs from text
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  return matches;
}

// Detect if user is asking to analyze/check a website
function isWebAnalysisRequest(text: string): boolean {
  const urls = extractUrls(text);
  if (urls.length === 0) return false;

  const lower = text.toLowerCase();
  const hasAnalysisIntent = /\b(analy[sz]e|check|review|inspect|scan|audit|examine|tell\s*me\s*about|what\s*is|details?\s*(about|of|on)|info(rmation)?\s*(about|of|on)|describe|explain|overview|look\s*at|visit|open|show\s*me|go\s*to|about\s*this|what.*website|website.*what)\b/i.test(lower);
  if (hasAnalysisIntent) return true;

  const urlRemoved = text.replace(/https?:\/\/[^\s]+/g, "").trim();
  if (urlRemoved.length < 30) return true;

  return false;
}

/** Fetch a webpage and extract text content */
async function fetchWebpageContent(url: string): Promise<{ html: string; text: string; title: string; meta: Record<string, string>; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SuperCopilotBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { html: "", text: "", title: "", meta: {}, error: `AUTH_REQUIRED (${resp.status})` };
      }
      return { html: "", text: "", title: "", meta: {}, error: `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { html: "", text: "", title: "", meta: {}, error: `Non-HTML content: ${contentType}` };
    }

    const html = await resp.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    // Extract meta tags
    const meta: Record<string, string> = {};
    const metaRegex = /<meta\s+(?:[^>]*?(?:name|property)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*?)["']|[^>]*?content\s*=\s*["']([^"']*?)["'][^>]*?(?:name|property)\s*=\s*["']([^"']+)["'])[^>]*>/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      const name = (metaMatch[1] || metaMatch[4] || "").toLowerCase();
      const content = metaMatch[2] || metaMatch[3] || "";
      if (name && content) meta[name] = content;
    }

    // Extract visible text: remove scripts, styles, then tags
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " [FOOTER] ")
      .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to ~8000 chars to fit in context
    if (text.length > 8000) text = text.slice(0, 8000) + "... [TRUNCATED]";

    return { html: html.slice(0, 2000), text, title, meta };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { html: "", text: "", title: "", meta: {}, error: "TIMEOUT" };
    }
    return { html: "", text: "", title: "", meta: {}, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, toolId, webAnalysis, sessionId, userId } = await req.json();

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

    // If web analysis, fetch the webpage directly and inject content
    let webpageContext = "";
    if (isWebAnalysis) {
      const urls = extractUrls(lastUserText);
      if (urls.length > 0) {
        console.log("Fetching webpage:", urls[0]);
        const page = await fetchWebpageContent(urls[0]);

        if (page.error === "AUTH_REQUIRED (401)" || page.error === "AUTH_REQUIRED (403)") {
          webpageContext = `\n\n--- WEBPAGE FETCH RESULT ---\nURL: ${urls[0]}\n⚠️ AUTHENTICATION REQUIRED: The server returned HTTP ${page.error}. This website requires login/authentication. Report this clearly to the user.\n---`;
        } else if (page.error) {
          webpageContext = `\n\n--- WEBPAGE FETCH RESULT ---\nURL: ${urls[0]}\n⚠️ Could not fetch page directly (${page.error}). Use Google Search grounding data below instead.\n---`;
        } else {
          const metaStr = Object.entries(page.meta).map(([k, v]) => `  ${k}: ${v}`).join("\n");
          webpageContext = `\n\n--- WEBPAGE CONTENT (FETCHED DIRECTLY) ---\nURL: ${urls[0]}\nTitle: ${page.title}\nMeta Tags:\n${metaStr}\n\nPage Text Content:\n${page.text}\n--- END WEBPAGE CONTENT ---`;
        }
      }
    }

    const systemPrompt = isWebAnalysis
      ? WEB_ANALYSIS_SYSTEM_PROMPT + webpageContext
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

    // Buffer the complete response instead of streaming
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

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
          const parts = parsed.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.text) {
                fullResponse += part.text;
              }
            }
          }
        } catch {
          // partial JSON, skip
        }
      }
    }

    // Save user message and AI response to database
    if (sessionId && userId && fullResponse) {
      const supabase = getSupabaseAdmin();
      
      // Save user message
      const lastUserMsg = messages[messages.length - 1];
      const userContent = typeof lastUserMsg.content === "string" 
        ? lastUserMsg.content 
        : (Array.isArray(lastUserMsg.content) 
          ? lastUserMsg.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
          : "");
      
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "user",
        content: userContent,
        metadata: { toolId },
      });

      // Save AI response
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: fullResponse,
        metadata: { toolId },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Response saved to database" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
