import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type VideoScene = {
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
  duration: number;
  transition: string;
};

export type VideoScript = {
  title: string;
  scenes: VideoScene[];
};

export type PipelineStage =
  | "idle"
  | "generating_script"
  | "generating_assets"
  | "assembling_video"
  | "done"
  | "error";

export type PipelineProgress = {
  stage: PipelineStage;
  progress: number; // 0-100
  message: string;
  script?: VideoScript;
  videoUrl?: string;
  error?: string;
};

type ProgressCallback = (progress: PipelineProgress) => void;

export async function generateVideoScript(
  topic: string,
  duration: number,
  aspectRatio: string
): Promise<VideoScript> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-video-script`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ topic, duration, aspect_ratio: aspectRatio }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Script generation failed");
  return data as VideoScript;
}

export async function generateTTS(text: string): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ text, speakingRate: 1.05 }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "TTS failed");
  return data.audioContent; // base64
}

export async function generateSceneImage(
  prompt: string,
  aspectRatio: string
): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, model: "flux" }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Image generation failed");
  const img = data.images?.[0];
  if (img?.base64) return `data:image/png;base64,${img.base64}`;
  if (img?.url) return img.url;
  if (typeof img === "string") return img;
  throw new Error("No image returned");
}

async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function runVideoPipeline(
  topic: string,
  duration: number,
  aspectRatio: string,
  onProgress: ProgressCallback
): Promise<string> {
  try {
    // Stage 1: Generate script
    onProgress({ stage: "generating_script", progress: 5, message: "Writing your script with AI..." });

    const script = await generateVideoScript(topic, duration, aspectRatio);
    onProgress({ stage: "generating_script", progress: 20, message: `Script ready: ${script.scenes.length} scenes`, script });

    // Stage 2: Generate assets (images + TTS) in parallel
    onProgress({ stage: "generating_assets", progress: 25, message: "Generating visuals and voice..." });

    const totalAssets = script.scenes.length * 2;
    let completedAssets = 0;

    const sceneAssets = await Promise.all(
      script.scenes.map(async (scene, idx) => {
        // Generate image and TTS in parallel for each scene
        const [imageUrl, audioBase64] = await Promise.all([
          generateSceneImage(scene.imagePrompt, aspectRatio).then((url) => {
            completedAssets++;
            onProgress({
              stage: "generating_assets",
              progress: 25 + Math.round((completedAssets / totalAssets) * 45),
              message: `Scene ${idx + 1}/${script.scenes.length}: image ready`,
              script,
            });
            return url;
          }),
          generateTTS(scene.narration).then((audio) => {
            completedAssets++;
            onProgress({
              stage: "generating_assets",
              progress: 25 + Math.round((completedAssets / totalAssets) * 45),
              message: `Scene ${idx + 1}/${script.scenes.length}: voice ready`,
              script,
            });
            return audio;
          }),
        ]);

        return { imageUrl, audioBase64 };
      })
    );

    // Stage 3: Assemble video with ffmpeg
    onProgress({ stage: "assembling_video", progress: 72, message: "Loading video engine..." });

    const ffmpeg = await getFFmpeg();

    onProgress({ stage: "assembling_video", progress: 75, message: "Assembling your video..." });

    // Write all scene assets to ffmpeg's virtual filesystem
    for (let i = 0; i < sceneAssets.length; i++) {
      const { imageUrl, audioBase64 } = sceneAssets[i];
      const imageData = await fetchImageAsUint8Array(imageUrl);
      const audioData = base64ToUint8Array(audioBase64);

      await ffmpeg.writeFile(`scene_${i}.jpg`, imageData);
      await ffmpeg.writeFile(`scene_${i}.mp3`, audioData);
    }

    // Create individual scene videos
    const sceneFiles: string[] = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const outFile = `segment_${i}.mp4`;

      // Create video from still image + audio
      await ffmpeg.exec([
        "-loop", "1",
        "-i", `scene_${i}.jpg`,
        "-i", `scene_${i}.mp3`,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-t", String(scene.duration),
        outFile,
      ]);

      sceneFiles.push(outFile);

      onProgress({
        stage: "assembling_video",
        progress: 75 + Math.round(((i + 1) / script.scenes.length) * 20),
        message: `Rendering scene ${i + 1}/${script.scenes.length}...`,
        script,
      });
    }

    // Create concat list
    const concatList = sceneFiles.map((f) => `file '${f}'`).join("\n");
    await ffmpeg.writeFile("concat.txt", concatList);

    // Concatenate all segments
    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-c", "copy",
      "final.mp4",
    ]);

    // Read output
    const outputData = await ffmpeg.readFile("final.mp4");
    const videoBlob = new Blob([outputData], { type: "video/mp4" });
    const videoUrl = URL.createObjectURL(videoBlob);

    // Cleanup virtual FS
    for (let i = 0; i < sceneAssets.length; i++) {
      try {
        await ffmpeg.deleteFile(`scene_${i}.jpg`);
        await ffmpeg.deleteFile(`scene_${i}.mp3`);
        await ffmpeg.deleteFile(`segment_${i}.mp4`);
      } catch {}
    }
    try {
      await ffmpeg.deleteFile("concat.txt");
      await ffmpeg.deleteFile("final.mp4");
    } catch {}

    onProgress({ stage: "done", progress: 100, message: "Video ready!", script, videoUrl });

    return videoUrl;
  } catch (e: any) {
    onProgress({
      stage: "error",
      progress: 0,
      message: e.message || "Pipeline failed",
      error: e.message,
    });
    throw e;
  }
}
