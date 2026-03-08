import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "square_1_1", "4:3": "classic_4_3", "3:4": "traditional_3_4",
  "16:9": "widescreen_16_9", "9:16": "social_story_9_16", "3:2": "standard_3_2",
  "2:3": "portrait_2_3", "2:1": "horizontal_2_1", "1:2": "vertical_1_2", "4:5": "social_post_4_5",
};

// ── Primary: Lovable AI with Gemini 2.5 Flash Image ──
async function editWithLovableAI(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  instruction: string
): Promise<{ imageUrl: string; prompt: string } | null> {
  try {
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: instruction,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lovable AI image edit error:", response.status, errText.slice(0, 300));

      if (response.status === 429) {
        console.warn("Lovable AI rate limited, will fall back to Freepik");
        return null;
      }
      if (response.status === 402) {
        console.warn("Lovable AI payment required, will fall back to Freepik");
        return null;
      }
      return null;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const editedImage = message?.images?.[0]?.image_url?.url;
    const textResponse = message?.content || instruction;

    if (editedImage) {
      return { imageUrl: editedImage, prompt: textResponse };
    }

    console.warn("No image in Lovable AI response, falling back");
    return null;
  } catch (e) {
    console.error("Lovable AI error:", e);
    return null;
  }
}

// ── Fallback: Gemini analysis + Freepik generation ──
function getGeminiKeys(): string[] {
  const keys: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]) {
    const k = Deno.env.get(`GEMINI_API_KEY${suffix}`);
    if (k) keys.push(k);
  }
  return keys;
}

async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string,
  userInstruction: string
): Promise<string> {
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length === 0) throw new Error("No Gemini API keys configured");

  const body = JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are an expert image analyst and prompt engineer. Analyze this image and create a detailed prompt for an AI image generator that incorporates the user's modifications.

User's instruction: "${userInstruction}"

Analyze: subject, composition, color palette, lighting, style, mood, textures, background, camera angle.
Create a single comprehensive image generation prompt. Output ONLY the prompt text.`,
        },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
  });

  for (const key of geminiKeys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );
      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
      console.warn(`Gemini key failed (${response.status})`);
      if (response.status !== 429 && response.status !== 503 && response.status !== 500) break;
    } catch (e) {
      console.warn("Gemini fetch error:", e);
    }
  }
  throw new Error("All Gemini keys failed for image analysis");
}

async function generateWithFreepik(
  apiKey: string,
  prompt: string,
  aspectRatio: string
): Promise<string> {
  const freepikAspect = ASPECT_RATIOS[aspectRatio] || "square_1_1";

  const createRes = await fetch(
    "https://api.freepik.com/v1/ai/text-to-image/flux-dev",
    {
      method: "POST",
      headers: {
        "x-freepik-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: freepikAspect }),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Freepik error [${createRes.status}]: ${errText}`);
  }

  const createData = await createRes.json();
  const taskId = createData.data?.task_id || createData.task_id;

  if (!taskId) {
    const generated = createData.data?.generated || [];
    const first = Array.isArray(generated) ? generated[0] : generated;
    if (first) return typeof first === "string" ? first : first.url || first;
    throw new Error("No image returned");
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/flux-dev/${taskId}`,
      { headers: { "x-freepik-api-key": apiKey, Accept: "application/json" } }
    );
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const status = pollData.data?.status || pollData.status;
    if (status === "COMPLETED") {
      const generated = pollData.data?.generated || pollData.generated || [];
      const first = Array.isArray(generated) ? generated[0] : generated;
      if (first) return typeof first === "string" ? first : first.url || first;
      throw new Error("No image in completed task");
    }
    if (status === "FAILED") throw new Error("Image generation failed");
  }
  throw new Error("Image generation timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, mimeType, instruction, aspect_ratio = "1:1" } = await req.json();

    if (!image || !instruction) {
      return new Response(
        JSON.stringify({ error: "Image and instruction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // ── Primary: Lovable AI with Gemini 2.5 Flash Image (direct image editing) ──
    if (LOVABLE_API_KEY) {
      console.log("Attempting image edit via Lovable AI (Gemini 2.5 Flash Image)");
      const result = await editWithLovableAI(
        LOVABLE_API_KEY,
        image,
        mimeType || "image/png",
        instruction
      );

      if (result) {
        return new Response(
          JSON.stringify({
            images: [{ url: result.imageUrl }],
            prompt: result.prompt,
            provider: "lovable-ai",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Lovable AI failed, falling back to Gemini analysis + Freepik");
    }

    // ── Fallback: Gemini text analysis → Freepik image generation ──
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");
    if (!FREEPIK_API_KEY) throw new Error("No image generation provider available");

    const generatedPrompt = await analyzeImageWithGemini(
      image,
      mimeType || "image/png",
      instruction
    );

    const imageUrl = await generateWithFreepik(FREEPIK_API_KEY, generatedPrompt, aspect_ratio);

    return new Response(
      JSON.stringify({
        images: [{ url: imageUrl }],
        prompt: generatedPrompt,
        provider: "freepik",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("image-to-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
