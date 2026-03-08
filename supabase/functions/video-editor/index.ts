import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDITING_TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_full_video",
      description: "Generate a complete new video from a topic. Use when user wants to create a video from scratch.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The video topic/subject" },
          duration: { type: "number", description: "Video duration in seconds (10-60)" },
          aspect_ratio: { type: "string", enum: ["9:16", "16:9", "1:1", "4:3", "4:5"], description: "Video aspect ratio" },
          style: { type: "string", description: "Visual style (e.g. cinematic, minimal, vibrant, dark, retro)" },
        },
        required: ["topic", "duration", "aspect_ratio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_video",
      description: "Apply editing operations to the current video project. Can perform multiple operations at once.",
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "trim", "split", "delete_scene", "reorder",
                    "transition", "text_overlay", "filter",
                    "speed", "zoom_pan", "add_music",
                    "regenerate_image", "regenerate_voice",
                    "adjust_timing", "crop", "color_grade",
                    "remove_filter", "clear_overlays",
                    "duplicate_scene", "reverse",
                  ],
                },
                sceneIndex: { type: "number", description: "0-based scene index to apply operation" },
                params: {
                  type: "object",
                  description: "Operation-specific parameters",
                  properties: {
                    startTime: { type: "number" },
                    endTime: { type: "number" },
                    duration: { type: "number" },
                    text: { type: "string" },
                    position: { type: "string", enum: ["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"] },
                    fontSize: { type: "number" },
                    fontColor: { type: "string" },
                    effect: { type: "string", enum: ["fade", "dissolve", "wipe_left", "wipe_right", "slide_left", "slide_right", "zoom_in", "zoom_out"] },
                    filter: { type: "string", enum: ["brighten", "darken", "warm", "cool", "saturate", "desaturate", "contrast", "vintage", "cinematic", "noir", "blur"] },
                    intensity: { type: "number", description: "Filter intensity 0.0-1.0" },
                    factor: { type: "number", description: "Speed factor (0.25-4.0)" },
                    zoomStart: { type: "number", description: "Zoom start scale (1.0 = normal)" },
                    zoomEnd: { type: "number", description: "Zoom end scale" },
                    panDirection: { type: "string", enum: ["left", "right", "up", "down"] },
                    fromIndex: { type: "number" },
                    toIndex: { type: "number" },
                    newPrompt: { type: "string", description: "New image prompt for regeneration" },
                    newNarration: { type: "string", description: "New narration text for voice regeneration" },
                    musicQuery: { type: "string", description: "Search query for background music" },
                    volume: { type: "number", description: "Volume level 0.0-1.0" },
                    cropX: { type: "number" },
                    cropY: { type: "number" },
                    cropWidth: { type: "number" },
                    cropHeight: { type: "number" },
                  },
                },
              },
              required: ["type", "params"],
            },
          },
          explanation: { type: "string", description: "Brief explanation of what changes are being made and why" },
        },
        required: ["operations", "explanation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_video",
      description: "Analyze the current video project and provide feedback or suggestions.",
      parameters: {
        type: "object",
        properties: {
          analysis_type: {
            type: "string",
            enum: ["pacing", "engagement", "visual_consistency", "audio_quality", "overall", "improvements"],
          },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                issue: { type: "string" },
                fix: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["issue", "fix", "priority"],
            },
          },
          summary: { type: "string" },
        },
        required: ["analysis_type", "summary", "suggestions"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a professional AI video editor. You handle ALL video editing decisions autonomously — the user simply describes what they want, and you execute it perfectly.

You have access to a video editing project with scenes. Each scene has:
- An image (AI-generated or stock footage)
- Voice narration (TTS)
- Duration, transitions, and effects

EDITING CAPABILITIES:
1. **trim** - Cut scene to specific time range
2. **split** - Split a scene into two at a specific point
3. **delete_scene** - Remove a scene entirely
4. **reorder** - Move a scene to a different position
5. **transition** - Add/change transition between scenes (fade, dissolve, wipe, slide, zoom)
6. **text_overlay** - Add text on screen with positioning
7. **filter** - Apply visual filters (brighten, darken, warm, cool, saturate, desaturate, vintage, cinematic, noir, blur)
8. **speed** - Change playback speed (slow-mo: 0.25-0.9, fast: 1.1-4.0)
9. **zoom_pan** - Ken Burns zoom/pan effect for dynamic movement
10. **add_music** - Add background music track
11. **regenerate_image** - Create a new image for a scene with a new prompt
12. **regenerate_voice** - Re-record voiceover with new narration text
13. **adjust_timing** - Change scene duration
14. **crop** - Crop the video frame
15. **color_grade** - Apply professional color grading presets
16. **remove_filter** - Remove a specific filter from a scene
17. **clear_overlays** - Remove all text overlays from a scene
18. **duplicate_scene** - Clone a scene
19. **reverse** - Reverse playback of a scene

RULES:
- Always use edit_video for any editing request, applying multiple operations at once when logical
- For new video creation, use generate_full_video
- When asked to improve/enhance, use analyze_video first mentally, then apply edit_video
- Make professional editing decisions: proper pacing, smooth transitions, visual consistency
- Be decisive — don't ask the user what to do, just do it professionally
- When user says "make it better" or "improve it", apply comprehensive edits
- Always include an explanation of changes made
- If no video project exists yet, use generate_full_video first`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectState } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Build context with project state
    let contextPrompt = SYSTEM_PROMPT;
    if (projectState) {
      contextPrompt += `\n\nCURRENT PROJECT STATE:\n${JSON.stringify(projectState, null, 2)}`;
    } else {
      contextPrompt += `\n\nNo video project exists yet. If the user wants to edit, create a new video first with generate_full_video.`;
    }

    // Convert messages to Gemini format
    const geminiContents: any[] = [];
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      geminiContents.push({
        role,
        parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
      });
    }

    // Convert tools to Gemini format
    const geminiTools = [{
      function_declarations: EDITING_TOOLS.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: contextPrompt }] },
          contents: geminiContents,
          tools: geminiTools,
          tool_config: { function_calling_config: { mode: "AUTO" } },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error [${res.status}]`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("No response from AI");

    const parts = candidate.content?.parts || [];
    const result: { text?: string; toolCalls?: any[] } = {};

    for (const part of parts) {
      if (part.text) {
        result.text = (result.text || "") + part.text;
      }
      if (part.functionCall) {
        if (!result.toolCalls) result.toolCalls = [];
        result.toolCalls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("video-editor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
