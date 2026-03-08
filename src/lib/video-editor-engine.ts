import { assembleWebM, type AssemblyProject, type AssemblyScene } from "./webm-assembler";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

export type EditOperation = {
  type: string;
  sceneIndex?: number;
  params: Record<string, any>;
};

export type TextOverlay = {
  text: string;
  position: string;
  fontSize: number;
  fontColor: string;
};

export type VideoProject = {
  title: string;
  scenes: AssemblyScene[];
  aspectRatio: string;
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

// ── Apply edit operations to project state ──

export function applyOperations(project: VideoProject, operations: EditOperation[]): VideoProject {
  const p = JSON.parse(JSON.stringify(project)) as VideoProject;

  for (const op of operations) {
    const idx = op.sceneIndex ?? 0;
    const scene = p.scenes[idx];

    switch (op.type) {
      case "trim":
        if (scene) scene.duration = (op.params.endTime ?? scene.duration) - (op.params.startTime ?? 0);
        break;
      case "delete_scene":
        if (idx >= 0 && idx < p.scenes.length) p.scenes.splice(idx, 1);
        break;
      case "reorder":
        if (op.params.fromIndex !== undefined && op.params.toIndex !== undefined) {
          const [moved] = p.scenes.splice(op.params.fromIndex, 1);
          if (moved) p.scenes.splice(op.params.toIndex, 0, moved);
        }
        break;
      case "transition":
        if (scene) scene.transition = op.params.effect || "fade";
        break;
      case "text_overlay":
        if (scene) scene.textOverlays.push({
          text: op.params.text || "",
          position: op.params.position || "bottom",
          fontSize: op.params.fontSize || 48,
          fontColor: op.params.fontColor || "white",
        });
        break;
      case "filter":
        if (scene && op.params.filter) scene.filters.push(op.params.filter);
        break;
      case "speed":
        if (scene && op.params.factor) scene.speed = Math.max(0.25, Math.min(4.0, op.params.factor));
        break;
      case "zoom_pan":
        if (scene) scene.zoom = { start: op.params.zoomStart ?? 1.0, end: op.params.zoomEnd ?? 1.3 };
        break;
      case "adjust_timing":
        if (scene && op.params.duration) scene.duration = op.params.duration;
        break;
    }
  }
  return p;
}

// ── Render project to WebM ──

export async function renderProject(
  project: VideoProject,
  onProgress: ProgressCallback
): Promise<string> {
  const tasks: EditorTask[] = [
    { id: "assemble", label: "Assemble Video", status: "working" },
    { id: "export", label: "Export WebM", status: "pending" },
  ];

  const emit = (updates?: Partial<EditorProgress>) => {
    const done = tasks.filter((t) => t.status === "done").length;
    onProgress({ tasks: [...tasks], overallProgress: Math.round((done / tasks.length) * 100), project, ...updates });
  };

  emit();

  try {
    const blob = await assembleWebM(
      { title: project.title, scenes: project.scenes, aspectRatio: project.aspectRatio },
      (p) => {
        tasks[0].detail = p.stage;
        emit();
      }
    );

    tasks[0].status = "done";
    tasks[0].detail = "Assembled";
    tasks[1].status = "working";
    tasks[1].detail = "Creating file...";
    emit();

    const videoUrl = URL.createObjectURL(blob);

    tasks[1].status = "done";
    tasks[1].detail = `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
    emit({ videoUrl });

    return videoUrl;
  } catch (e: any) {
    emit({ error: e.message });
    throw e;
  }
}
