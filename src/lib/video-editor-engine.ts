import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

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

// ── Filter Presets ──

const FILTER_MAP: Record<string, string> = {
  brighten: "eq=brightness=0.08",
  darken: "eq=brightness=-0.08",
  warm: "colorbalance=rs=0.1:gs=0.02:bs=-0.05",
  cool: "colorbalance=rs=-0.05:gs=0.02:bs=0.1",
  saturate: "eq=saturation=1.5",
  desaturate: "eq=saturation=0.5",
  contrast: "eq=contrast=1.3",
  vintage: "curves=vintage",
  cinematic: "eq=contrast=1.2:saturation=0.85:brightness=-0.02",
  noir: "eq=saturation=0:contrast=1.4:brightness=-0.03",
  blur: "boxblur=3:1",
};

// ── Types ──

export type EditOperation = {
  type: string;
  sceneIndex?: number;
  params: Record<string, any>;
};

export type SceneState = {
  imageUrl: string;
  audioBase64: string;
  narration: string;
  imagePrompt: string;
  duration: number;
  transition?: string;
  filters: string[];
  textOverlays: TextOverlay[];
  speed: number;
  zoom?: { start: number; end: number; panDirection?: string };
};

export type TextOverlay = {
  text: string;
  position: string;
  fontSize: number;
  fontColor: string;
  startTime?: number;
  duration?: number;
};

export type VideoProject = {
  title: string;
  scenes: SceneState[];
  aspectRatio: string;
  backgroundMusic?: { url: string; volume: number };
};

export type EditorTaskStatus = "pending" | "working" | "done" | "error";

export type EditorTask = {
  id: string;
  label: string;
  status: EditorTaskStatus;
  detail?: string;
};

export type EditorProgress = {
  tasks: EditorTask[];
  overallProgress: number;
  videoUrl?: string;
  error?: string;
  project?: VideoProject;
};

type ProgressCallback = (progress: EditorProgress) => void;

// ── Helpers ──

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchAsUint8Array(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    return base64ToUint8Array(base64);
  }
  const resp = await fetch(url);
  return new Uint8Array(await resp.arrayBuffer());
}

// ── Position to ffmpeg drawtext coordinates ──

function positionToXY(pos: string): { x: string; y: string } {
  switch (pos) {
    case "top": return { x: "(w-text_w)/2", y: "h*0.08" };
    case "top-left": return { x: "w*0.05", y: "h*0.08" };
    case "top-right": return { x: "w-text_w-w*0.05", y: "h*0.08" };
    case "center": return { x: "(w-text_w)/2", y: "(h-text_h)/2" };
    case "bottom": return { x: "(w-text_w)/2", y: "h-text_h-h*0.08" };
    case "bottom-left": return { x: "w*0.05", y: "h-text_h-h*0.08" };
    case "bottom-right": return { x: "w-text_w-w*0.05", y: "h-text_h-h*0.08" };
    default: return { x: "(w-text_w)/2", y: "h-text_h-h*0.08" };
  }
}

// ── Build ffmpeg filter chain for a scene ──

function buildVideoFilter(scene: SceneState, width: number, height: number): string[] {
  const filters: string[] = [];

  // Scale to target dimensions
  filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);

  // Ken Burns zoom/pan
  if (scene.zoom) {
    const zs = scene.zoom.start || 1.0;
    const ze = scene.zoom.end || 1.3;
    const frames = Math.round(scene.duration * 30);
    filters.push(`zoompan=z='${zs}+(${ze}-${zs})*on/${frames}':d=${frames}:s=${width}x${height}:fps=30`);
  }

  // Color filters
  for (const f of scene.filters) {
    const mapped = FILTER_MAP[f];
    if (mapped) filters.push(mapped);
  }

  // Text overlays
  for (const t of scene.textOverlays) {
    const { x, y } = positionToXY(t.position);
    const safeText = t.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
    const enable = t.startTime !== undefined && t.duration !== undefined
      ? `:enable='between(t,${t.startTime},${t.startTime + t.duration})'`
      : "";
    filters.push(
      `drawtext=text='${safeText}':fontsize=${t.fontSize || 48}:fontcolor=${t.fontColor || "white"}:x=${x}:y=${y}:borderw=2:bordercolor=black${enable}`
    );
  }

  return filters;
}

// ── Render single scene ──

async function renderScene(
  ffmpeg: FFmpeg,
  scene: SceneState,
  idx: number,
  width: number,
  height: number
): Promise<string> {
  const imgFile = `edit_scene_${idx}.jpg`;
  const audioFile = `edit_audio_${idx}.mp3`;
  const outFile = `edit_seg_${idx}.mp4`;

  await ffmpeg.writeFile(imgFile, await fetchAsUint8Array(scene.imageUrl));
  await ffmpeg.writeFile(audioFile, base64ToUint8Array(scene.audioBase64));

  const vFilters = buildVideoFilter(scene, width, height);
  const filterStr = vFilters.length > 0 ? vFilters.join(",") : `scale=${width}:${height}`;

  const args: string[] = [
    "-loop", "1", "-i", imgFile,
    "-i", audioFile,
  ];

  // Speed adjustment
  if (scene.speed !== 1.0) {
    const audioPts = 1 / scene.speed;
    const atempo = scene.speed > 2 ? `atempo=${Math.sqrt(scene.speed)},atempo=${Math.sqrt(scene.speed)}` : `atempo=${scene.speed}`;
    args.push(
      "-filter_complex",
      `[0:v]${filterStr},setpts=${audioPts}*PTS[v];[1:a]${atempo}[a]`,
      "-map", "[v]", "-map", "[a]"
    );
  } else {
    args.push("-vf", filterStr);
  }

  args.push(
    "-c:v", "libx264", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "192k",
    "-pix_fmt", "yuv420p", "-shortest",
    "-t", String(scene.duration / scene.speed),
    "-r", "30",
    outFile
  );

  await ffmpeg.exec(args);
  return outFile;
}

// ── Get dimensions from aspect ratio ──

function getDimensions(aspectRatio: string): { width: number; height: number } {
  const dims: Record<string, [number, number]> = {
    "9:16": [1080, 1920],
    "16:9": [1920, 1080],
    "1:1": [1080, 1080],
    "4:3": [1440, 1080],
    "4:5": [1080, 1350],
    "3:4": [1080, 1440],
  };
  const [w, h] = dims[aspectRatio] || [1080, 1920];
  return { width: w, height: h };
}

// ── Apply edit operations to project state ──

export function applyOperations(project: VideoProject, operations: EditOperation[]): VideoProject {
  const p = JSON.parse(JSON.stringify(project)) as VideoProject;

  for (const op of operations) {
    const idx = op.sceneIndex ?? 0;
    const scene = p.scenes[idx];

    switch (op.type) {
      case "trim":
        if (scene) {
          scene.duration = (op.params.endTime ?? scene.duration) - (op.params.startTime ?? 0);
        }
        break;

      case "delete_scene":
        if (idx >= 0 && idx < p.scenes.length) {
          p.scenes.splice(idx, 1);
        }
        break;

      case "reorder":
        if (op.params.fromIndex !== undefined && op.params.toIndex !== undefined) {
          const [moved] = p.scenes.splice(op.params.fromIndex, 1);
          if (moved) p.scenes.splice(op.params.toIndex, 0, moved);
        }
        break;

      case "transition":
        if (scene) {
          scene.transition = op.params.effect || "fade";
        }
        break;

      case "text_overlay":
        if (scene) {
          scene.textOverlays.push({
            text: op.params.text || "",
            position: op.params.position || "bottom",
            fontSize: op.params.fontSize || 48,
            fontColor: op.params.fontColor || "white",
            startTime: op.params.startTime,
            duration: op.params.duration,
          });
        }
        break;

      case "filter":
        if (scene && op.params.filter) {
          scene.filters.push(op.params.filter);
        }
        break;

      case "speed":
        if (scene && op.params.factor) {
          scene.speed = Math.max(0.25, Math.min(4.0, op.params.factor));
        }
        break;

      case "zoom_pan":
        if (scene) {
          scene.zoom = {
            start: op.params.zoomStart ?? 1.0,
            end: op.params.zoomEnd ?? 1.3,
            panDirection: op.params.panDirection,
          };
        }
        break;

      case "adjust_timing":
        if (scene && op.params.duration) {
          scene.duration = op.params.duration;
        }
        break;

      case "add_music":
        p.backgroundMusic = {
          url: op.params.musicQuery || "",
          volume: op.params.volume ?? 0.3,
        };
        break;

      // regenerate_image and regenerate_voice are handled externally
      // since they require API calls
    }
  }

  return p;
}

// ── Full render pipeline ──

export async function renderProject(
  project: VideoProject,
  onProgress: ProgressCallback
): Promise<string> {
  const tasks: EditorTask[] = project.scenes.map((_, i) => ({
    id: `render-${i}`,
    label: `Render Scene ${i + 1}`,
    status: "pending" as EditorTaskStatus,
  }));
  tasks.push(
    { id: "merge", label: "Merge Scenes", status: "pending" },
    { id: "export", label: "Export MP4", status: "pending" }
  );

  const emit = (updates?: Partial<EditorProgress>) => {
    const done = tasks.filter((t) => t.status === "done").length;
    onProgress({
      tasks: [...tasks],
      overallProgress: Math.round((done / tasks.length) * 100),
      project,
      ...updates,
    });
  };

  try {
    tasks[0].status = "working";
    tasks[0].detail = "Loading engine...";
    emit();

    const ffmpeg = await getFFmpeg();
    const { width, height } = getDimensions(project.aspectRatio);

    // Render each scene
    const segmentFiles: string[] = [];
    for (let i = 0; i < project.scenes.length; i++) {
      const t = tasks.find((t) => t.id === `render-${i}`)!;
      t.status = "working";
      t.detail = "Encoding...";
      emit();

      const outFile = await renderScene(ffmpeg, project.scenes[i], i, width, height);
      segmentFiles.push(outFile);

      t.status = "done";
      t.detail = `${project.scenes[i].duration}s`;
      emit();
    }

    // Merge
    const mergeTask = tasks.find((t) => t.id === "merge")!;
    mergeTask.status = "working";
    mergeTask.detail = "Concatenating...";
    emit();

    const concatList = segmentFiles.map((f) => `file '${f}'`).join("\n");
    await ffmpeg.writeFile("edit_concat.txt", concatList);
    await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "edit_concat.txt", "-c", "copy", "edit_final.mp4"]);

    mergeTask.status = "done";
    emit();

    // Export
    const exportTask = tasks.find((t) => t.id === "export")!;
    exportTask.status = "working";
    exportTask.detail = "Exporting...";
    emit();

    const output = await ffmpeg.readFile("edit_final.mp4");
    const blob = new Blob([new Uint8Array(output as Uint8Array)], { type: "video/mp4" });
    const videoUrl = URL.createObjectURL(blob);

    exportTask.status = "done";
    exportTask.detail = "Complete";

    // Cleanup
    for (const f of segmentFiles) {
      try { await ffmpeg.deleteFile(f); } catch {}
    }
    for (let i = 0; i < project.scenes.length; i++) {
      try { await ffmpeg.deleteFile(`edit_scene_${i}.jpg`); } catch {}
      try { await ffmpeg.deleteFile(`edit_audio_${i}.mp3`); } catch {}
    }
    try { await ffmpeg.deleteFile("edit_concat.txt"); } catch {}
    try { await ffmpeg.deleteFile("edit_final.mp4"); } catch {}

    emit({ videoUrl });
    return videoUrl;
  } catch (e: any) {
    emit({ error: e.message });
    throw e;
  }
}
