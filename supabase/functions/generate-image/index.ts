import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "square_1_1",
  "4:3": "landscape_4_3",
  "16:9": "landscape_16_9",
  "3:4": "portrait_3_4",
  "9:16": "portrait_9_16",
};

const MODEL_ENDPOINTS: Record<string, string> = {
  mystic: "mystic",
  flux: "flux-dev",
  "flux-pro": "flux-pro-v1-1",
};

async function enhancePrompt(apiKey: string, userPrompt: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are an expert image prompt engineer. Given a user's image request, create a highly detailed, optimized prompt for an AI image generator. Include: subject details, composition, lighting, color palette, style, mood, camera angle, and technical quality keywords. Output ONLY the enhanced prompt text, nothing else. Keep it under 200 words.`
            }]
          },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini enhance error:", res.status);
      return userPrompt;
    }
    const data = await res.json();
    const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return enhanced || userPrompt;
  } catch (e) {
    console.error("Prompt enhancement failed:", e);
    return userPrompt;
  }
}

async function pollTask(apiKey: string, model: string, taskId: string, maxAttempts = 30): Promise<string[]> {
  const endpoint = MODEL_ENDPOINTS[model] || "flux-dev";

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/${endpoint}/${taskId}`,
      { headers: { "x-freepik-api-key": apiKey, Accept: "application/json" } }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Freepik poll error [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    const status = data.data?.status || data.status;

    if (status === "COMPLETED") {
      const generated = data.data?.generated || data.generated || [];
      return Array.isArray(generated) ? generated : [generated];
    }
    if (status === "FAILED") {
      throw new Error("Image generation failed");
    }
  }

  throw new Error("Image generation timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, aspect_ratio = "1:1", model = "flux", num_images = 1 } = await req.json();

    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!FREEPIK_API_KEY) throw new Error("FREEPIK_API_KEY is not configured");

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enhance prompt with Gemini 2.5 Flash
    const enhancedPrompt = GEMINI_API_KEY
      ? await enhancePrompt(GEMINI_API_KEY, prompt)
      : prompt;

    console.log("Original prompt:", prompt);
    console.log("Enhanced prompt:", enhancedPrompt);

    const endpoint = MODEL_ENDPOINTS[model] || "flux-dev";
    const freepikAspectRatio = ASPECT_RATIOS[aspect_ratio] || "square_1_1";

    const createRes = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/${endpoint}`,
      {
        method: "POST",
        headers: {
          "x-freepik-api-key": FREEPIK_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          num_images: Math.min(num_images, 4),
          aspect_ratio: freepikAspectRatio,
        }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Freepik create error:", createRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Freepik API error [${createRes.status}]`, details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createData = await createRes.json();
    console.log("Freepik response:", JSON.stringify(createData));
    const taskId = createData.data?.task_id || createData.task_id;

    if (!taskId) {
      const generated = createData.data?.generated || createData.data?.images?.generated || [];
      const urls: string[] = Array.isArray(generated) ? generated : [generated];
      const images = urls.filter(Boolean).map((url: string) => ({ url }));
      return new Response(
        JSON.stringify({ images, prompt: enhancedPrompt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urls = await pollTask(FREEPIK_API_KEY, model, taskId);
    const images = urls.filter(Boolean).map((url: string) => ({ url }));

    return new Response(
      JSON.stringify({ images, prompt: enhancedPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
