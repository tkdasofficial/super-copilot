import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

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

export type TaskStatus = "pending" | "working" | "done" | "error";

export type WorkerTask = {
  id: string;
  label: string;
  group: "script" | "image" | "voice" | "render" | "export";
  status: TaskStatus;
  detail?: string;
  sceneIndex?: number;
};

export type PipelineState = {
  tasks: WorkerTask[];
  script?: VideoScript;
  videoUrl?: string;
  overallProgress: number;
  error?: string;
};

type ProgressCallback = (state: PipelineState) => void;

function createInitialTasks(): WorkerTask[] {
  return [
    { id: "script", label: "Write Script", group: "script", status: "pending" },
  ];
}

function expandTasksWithScenes(tasks: WorkerTask[], sceneCount: number): WorkerTask[] {
  const expanded: WorkerTask[] = [
    { ...tasks[0] }, // script task
  ];
  for (let i = 0; i < sceneCount; i++) {
    expanded.push(
      { id: `img-${i}`, label: `Scene ${i + 1} Image`, group: "image", status: "pending", sceneIndex: i },
      { id: `tts-${i}`, label: `Scene ${i + 1} Voice`, group: "voice", status: "pending", sceneIndex: i },
    );
  }
  for (let i = 0; i < sceneCount; i++) {
    expanded.push(
      { id: `render-${i}`, label: `Render Scene ${i + 1}`, group: "render", status: "pending", sceneIndex: i },
    );
  }
  expanded.push(
    { id: "concat", label: "Merge Scenes", group: "export", status: "pending" },
    { id: "export", label: "Export MP4", group: "export", status: "pending" },
  );
  return expanded;
}

function updateTask(tasks: WorkerTask[], id: string, status: TaskStatus, detail?: string): WorkerTask[] {
  return tasks.map((t) => (t.id === id ? { ...t, status, detail: detail ?? t.detail } : t));
}

function calcProgress(tasks: WorkerTask[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

// ── API helpers ──

export async function generateVideoScript(
  topic: string,
  duration: number,
  aspectRatio: string
): Promise<VideoScript> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-video-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ topic, duration, aspect_ratio: aspectRatio }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Script generation failed");
  return data as VideoScript;
}

export async function generateTTS(text: string): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ text, speakingRate: 1.05 }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "TTS failed");
  return data.audioContent;
}

export async function generateSceneImage(prompt: string, aspectRatio: string): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
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

// ── Utils ──

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

// ── Main Pipeline ──

export async function runVideoPipeline(
  topic: string,
  duration: number,
  aspectRatio: string,
  onProgress: ProgressCallback
): Promise<string> {
  let tasks = createInitialTasks();

  const emit = (extra?: Partial<PipelineState>) => {
    onProgress({ tasks: [...tasks], overallProgress: calcProgress(tasks), ...extra });
  };

  try {
    // 1. Script
    tasks = updateTask(tasks, "script", "working", "AI is writing your script...");
    emit();

    const script = await generateVideoScript(topic, duration, aspectRatio);

    tasks = updateTask(tasks, "script", "done", `${script.scenes.length} scenes`);

    // Expand tasks now that we know scene count
    tasks = expandTasksWithScenes(tasks, script.scenes.length);
    emit({ script });

    // 2. Assets — images + TTS in parallel
    const sceneAssets: { imageUrl: string; audioBase64: string }[] = new Array(script.scenes.length);

    await Promise.all(
      script.scenes.map(async (scene, idx) => {
        // Image
        tasks = updateTask(tasks, `img-${idx}`, "working", "Generating...");
        emit({ script });

        let imageUrl: string;
        try {
          imageUrl = await generateSceneImage(scene.imagePrompt, aspectRatio);
          tasks = updateTask(tasks, `img-${idx}`, "done", "Ready");
        } catch (e: any) {
          tasks = updateTask(tasks, `img-${idx}`, "error", e.message);
          emit({ script });
          throw e;
        }

        emit({ script });

        // TTS
        tasks = updateTask(tasks, `tts-${idx}`, "working", "Synthesizing...");
        emit({ script });

        let audioBase64: string;
        try {
          audioBase64 = await generateTTS(scene.narration);
          tasks = updateTask(tasks, `tts-${idx}`, "done", "Ready");
        } catch (e: any) {
          tasks = updateTask(tasks, `tts-${idx}`, "error", e.message);
          emit({ script });
          throw e;
        }

        emit({ script });
        sceneAssets[idx] = { imageUrl, audioBase64 };
      })
    );

    // 3. Render scenes with ffmpeg
    tasks = updateTask(tasks, `render-0`, "working", "Loading engine...");
    emit({ script });

    const ffmpeg = await getFFmpeg();

    // Write all assets
    for (let i = 0; i < sceneAssets.length; i++) {
      const { imageUrl, audioBase64 } = sceneAssets[i];
      await ffmpeg.writeFile(`scene_${i}.jpg`, await fetchImageAsUint8Array(imageUrl));
      await ffmpeg.writeFile(`scene_${i}.mp3`, base64ToUint8Array(audioBase64));
    }

    const sceneFiles: string[] = [];
    for (let i = 0; i < script.scenes.length; i++) {
      tasks = updateTask(tasks, `render-${i}`, "working", "Encoding...");
      emit({ script });

      const scene = script.scenes[i];
      const outFile = `segment_${i}.mp4`;

      await ffmpeg.exec([
        "-loop", "1", "-i", `scene_${i}.jpg`,
        "-i", `scene_${i}.mp3`,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-shortest",
        "-t", String(scene.duration),
        outFile,
      ]);

      sceneFiles.push(outFile);
      tasks = updateTask(tasks, `render-${i}`, "done", `${scene.duration}s`);
      emit({ script });
    }

    // 4. Concat
    tasks = updateTask(tasks, "concat", "working", "Merging...");
    emit({ script });

    const concatList = sceneFiles.map((f) => `file '${f}'`).join("\n");
    await ffmpeg.writeFile("concat.txt", concatList);

    await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "final.mp4"]);

    tasks = updateTask(tasks, "concat", "done", "Merged");
    emit({ script });

    // 5. Export
    tasks = updateTask(tasks, "export", "working", "Exporting MP4...");
    emit({ script });

    const outputData = await ffmpeg.readFile("final.mp4");
    const videoBlob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
    const videoUrl = URL.createObjectURL(videoBlob);

    tasks = updateTask(tasks, "export", "done", "Complete");

    // Cleanup
    for (let i = 0; i < sceneAssets.length; i++) {
      try { await ffmpeg.deleteFile(`scene_${i}.jpg`); } catch {}
      try { await ffmpeg.deleteFile(`scene_${i}.mp3`); } catch {}
      try { await ffmpeg.deleteFile(`segment_${i}.mp4`); } catch {}
    }
    try { await ffmpeg.deleteFile("concat.txt"); } catch {}
    try { await ffmpeg.deleteFile("final.mp4"); } catch {}

    emit({ script, videoUrl });
    return videoUrl;
  } catch (e: any) {
    onProgress({
      tasks: [...tasks],
      overallProgress: calcProgress(tasks),
      error: e.message || "Pipeline failed",
    });
    throw e;
  }
}
