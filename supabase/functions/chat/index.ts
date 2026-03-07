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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, toolId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = toolId && TOOL_SYSTEM_PROMPTS[toolId]
      ? TOOL_SYSTEM_PROMPTS[toolId]
      : DEFAULT_SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
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
