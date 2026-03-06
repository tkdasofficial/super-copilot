import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOOL_SYSTEM_PROMPTS: Record<string, string> = {
  "script-writer": `You are an expert AI Script Writer for video creators. You specialize in writing engaging, retention-optimized scripts for YouTube videos, shorts, stories, and other platforms. Structure your scripts with clear sections: HOOK, INTRO, BODY (with numbered points or segments), CTA, and OUTRO. Include timing markers. Focus on viewer retention hooks, pattern interrupts, and engagement triggers. Always format output cleanly without markdown symbols.`,
  
  "thumbnail-designer": `You are an expert AI Thumbnail Designer. You create detailed thumbnail concepts optimized for maximum click-through rate (CTR). Provide: 1) Visual composition description, 2) Text overlay suggestions (keep it 3-5 words max), 3) Color palette recommendations, 4) Facial expression/emotion guidance, 5) Contrast and readability tips. Reference proven thumbnail patterns from top creators.`,
  
  "seo-optimizer": `You are an expert AI SEO Optimizer for video and content platforms. You generate optimized titles, descriptions, tags, and keywords. Provide: 1) SEO-optimized title options (under 60 chars), 2) Full video description with timestamps and keywords, 3) Relevant tags and keywords list, 4) Hashtag suggestions, 5) Search ranking tips. Use data-driven approaches.`,
  
  "image-generator": `You are an expert AI Image Creator assistant. When users request images, create highly detailed, optimized prompts for image generation. Describe: subject, composition, lighting, color palette, style, mood, camera angle, and technical details. If the user wants you to generate an image, provide the detailed prompt and let them know the image will be generated.`,
  
  "content-optimizer": `You are a comprehensive Content Optimizer AI. You provide full content packages including: script outlines, SEO optimization, thumbnail concepts, tag strategies, and growth recommendations. Analyze content holistically and provide actionable optimization across all dimensions.`,
  
  "content-analyzer": `You are an expert Content Analyzer AI. You analyze existing content (scripts, thumbnails, descriptions, strategies) and provide specific, actionable improvement suggestions. Focus on: retention analysis, CTR optimization, SEO strength, audience engagement, and competitive positioning. Be constructive and specific.`,
};

const DEFAULT_SYSTEM_PROMPT = `You are Super Copilot, a powerful AI assistant for content creators. You help with brainstorming, writing, strategy, analysis, and creative tasks. Be helpful, concise, and actionable. Format responses clearly with numbered lists and structured sections when appropriate. Do not use markdown symbols like asterisks or hashes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, toolId } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = toolId && TOOL_SYSTEM_PROMPTS[toolId]
      ? TOOL_SYSTEM_PROMPTS[toolId]
      : DEFAULT_SYSTEM_PROMPT;

    // Convert messages to Gemini format
    const geminiContents = [];
    
    // Add system instruction as first user message context
    geminiContents.push({
      role: "user",
      parts: [{ text: `System instructions: ${systemPrompt}` }],
    });
    geminiContents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow these instructions." }],
    });

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      const parts: any[] = [];
      
      if (typeof msg.content === "string") {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push({ text: part.text });
          } else if (part.type === "image_url") {
            const url = part.image_url.url;
            if (url.startsWith("data:")) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: { mimeType: match[1], data: match[2] },
                });
              }
            }
          }
        }
      }
      
      if (parts.length > 0) {
        geminiContents.push({ role, parts });
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const sseData = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${sseData}\n\n`)
                  );
                }
              } catch {
                // skip malformed
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        }

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

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
