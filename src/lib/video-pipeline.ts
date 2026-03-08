/**
 * Video pipeline — server-side orchestration + client-side WebM assembly.
 * All AI work (script, images, TTS) runs server-side via SSE streaming.
 * Only final frame rendering uses browser Canvas + MediaRecorder.
 */

import { assembleWebM, type AssemblyProject, type AssemblyScene } from "./webm-assembler";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

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

// ── Helpers ──

function calcProgress(tasks: WorkerTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}

// ── Server-Side Pipeline with SSE ──

export async function runVideoPipeline(
  topic: string,
  duration: number,
  aspectRatio: string,
  onProgress: ProgressCallback
): Promise<string> {
  let tasks: WorkerTask[] = [
    { id: "script", label: "Write Script", group: "script", status: "pending" },
  ];
  let script: VideoScript | undefined;
  let assemblyScenes: AssemblyScene[] = [];

  const emit = (extra?: Partial<PipelineState>) => {
    onProgress({ tasks: [...tasks], overallProgress: calcProgress(tasks), script, ...extra });
  };

  try {
    // Connect to server-side pipeline via SSE
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/video-render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action: "generate", topic, duration, aspect_ratio: aspectRatio }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "Server pipeline failed");
    }

    // Process SSE events from server
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assetsComplete = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          switch (event.type) {
            case "task_update": {
              const existing = tasks.find((t) => t.id === event.id);
              if (existing) {
                existing.status = event.status;
                if (event.detail) existing.detail = event.detail;
                if (event.label) existing.label = event.label;
              } else {
                tasks.push({
                  id: event.id,
                  label: event.label || event.id,
                  group: event.group || "script",
                  status: event.status,
                  detail: event.detail,
                });
              }
              emit();
              break;
            }

            case "script_ready":
              script = event.script;
              emit();
              break;

            case "scene_ready":
              assemblyScenes[event.index] = event.scene;
              break;

            case "assets_complete":
              assetsComplete = true;
              assemblyScenes = event.scenes;
              script = { title: event.title, scenes: event.scenes };
              break;

            case "error":
              throw new Error(event.message);

            case "done":
              break;
          }
        } catch (e: any) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }

    if (!assetsComplete || assemblyScenes.length === 0) {
      throw new Error("Server did not complete asset generation");
    }

    // ── Client-side WebM assembly ──
    const assembleTask: WorkerTask = { id: "assemble", label: "Assemble Video", group: "render", status: "working" };
    const exportTask: WorkerTask = { id: "export", label: "Export WebM", group: "export", status: "pending" };
    tasks.push(assembleTask, exportTask);
    emit();

    const assemblyProject: AssemblyProject = {
      title: script?.title || topic,
      scenes: assemblyScenes,
      aspectRatio,
    };

    const videoBlob = await assembleWebM(assemblyProject, (progress) => {
      assembleTask.detail = progress.stage;
      emit();
    });

    assembleTask.status = "done";
    assembleTask.detail = "Assembled";
    exportTask.status = "working";
    exportTask.detail = "Creating download...";
    emit();

    const videoUrl = URL.createObjectURL(videoBlob);

    exportTask.status = "done";
    exportTask.detail = `${(videoBlob.size / 1024 / 1024).toFixed(1)} MB`;
    emit({ videoUrl });

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

// Re-export types for editor engine compatibility
export type { AssemblyScene, AssemblyProject };
