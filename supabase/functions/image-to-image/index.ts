import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASPECT_RATIOS: Record<string, string> = {
  "1:1": "square_1_1",
  "4:3": "classic_4_3",
  "3:4": "traditional_3_4",
  "16:9": "widescreen_16_9",
  "9:16": "social_story_9_16",
  "3:2": "standard_3_2",
  "2:3": "portrait_2_3",
  "2:1": "horizontal_2_1",
  "1:2": "vertical_1_2",
  "4:5": "social_post_4_5",
};

// Gather all Gemini keys
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
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert image analyst and prompt engineer. Analyze this image in extreme detail and create a highly optimized, detailed prompt for an AI image generator to create a similar or enhanced version.

User's instruction: "${userInstruction}"

Analyze the image for:
- Subject matter and main elements
- Composition and layout
- Color palette and lighting
- Style (photographic, illustration, 3D render, etc.)
- Mood and atmosphere
- Textures and materials
- Background elements
- Any text or typography
- Camera angle and perspective

Based on your analysis and the user's instruction, create a single, comprehensive image generation prompt. The prompt should be detailed enough to reproduce the essence of the image while incorporating the user's modifications. Output ONLY the prompt text, nothing else.`,
          },
          {
            inlineData: { mimeType, data: imageBase64 },
          },
        ],
      },
    ],
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
      const errText = await response.text();
      console.warn(`Gemini key failed (${response.status}):`, errText.slice(0, 200));
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
): Promise<any[]> {
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
      body: JSON.stringify({
        prompt,
        num_images: 1,
        aspect_ratio: freepikAspect,
      }),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Freepik error [${createRes.status}]: ${errText}`);
  }

  const createData = await createRes.json();
  const taskId = createData.data?.task_id || createData.task_id;

  if (!taskId) {
    const generated = createData.data?.generated || createData.data?.images?.generated || [];
    const urls: string[] = Array.isArray(generated) ? generated : [generated];
    return urls.filter(Boolean).map((url: string) => ({ url }));
  }

  // Poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/flux-dev/${taskId}`,
      { headers: { "x-freepik-api-key": apiKey, Accept: "application/json" } }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    if (pollData.status === "COMPLETED" || pollData.data?.status === "COMPLETED") {
      const generated = pollData.data?.generated || pollData.generated || [];
      const urls: string[] = Array.isArray(generated) ? generated : [generated];
      return urls.filter(Boolean).map((url: string) => ({ url }));
    }
    if (pollData.status === "FAILED" || pollData.data?.status === "FAILED") {
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
    const { image, mimeType, instruction, aspect_ratio = "1:1" } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY");

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    if (!FREEPIK_API_KEY) throw new Error("FREEPIK_API_KEY is not configured");

    if (!image || !instruction) {
      return new Response(
        JSON.stringify({ error: "Image and instruction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Analyze image with Gemini
    const generatedPrompt = await analyzeImageWithGemini(
      GEMINI_API_KEY,
      image,
      mimeType || "image/png",
      instruction
    );

    // Step 2: Generate new image with Freepik
    const images = await generateWithFreepik(FREEPIK_API_KEY, generatedPrompt, aspect_ratio);

    return new Response(
      JSON.stringify({ images, prompt: generatedPrompt }),
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
