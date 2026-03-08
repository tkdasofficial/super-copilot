import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download, Film, Sparkles, ImageIcon, Volume2, Clapperboard,
  CheckCircle2, AlertCircle, Loader2, Clock, Package, ChevronDown, ChevronUp,
  Scissors, RefreshCw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  type VideoProject, type SceneState, type EditorProgress, type EditorTask, type EditorTaskStatus,
  applyOperations, renderProject,
} from "@/lib/video-editor-engine";
import {
  generateVideoScript, generateTTS, generateSceneImage,
  type VideoScript, type PipelineState, type WorkerTask, type TaskStatus,
} from "@/lib/video-pipeline";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Types ──

type EditorCardProps = {
  userMessage: string;
  existingProject?: VideoProject;
  onProjectUpdate?: (project: VideoProject) => void;
  onVideoReady?: (url: string) => void;
};

type Phase = "analyzing" | "planning" | "generating" | "editing" | "rendering" | "done" | "error";

const PHASE_CONFIG: Record<Phase, { icon: typeof Film; label: string }> = {
  analyzing: { icon: Sparkles, label: "Analyzing Request" },
  planning: { icon: Scissors, label: "Planning Edits" },
  generating: { icon: ImageIcon, label: "Generating Assets" },
  editing: { icon: Scissors, label: "Applying Edits" },
  rendering: { icon: Clapperboard, label: "Rendering" },
  done: { icon: CheckCircle2, label: "Complete" },
  error: { icon: AlertCircle, label: "Failed" },
};

const STATUS_ICON: Record<EditorTaskStatus, typeof CheckCircle2> = {
  pending: Clock,
  working: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
};

// ── Component ──

const VideoEditorCard = ({ userMessage, existingProject, onProjectUpdate, onVideoReady }: EditorCardProps) => {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [tasks, setTasks] = useState<EditorTask[]>([
    { id: "ai-decide", label: "AI Decision", status: "working" },
  ]);
  const [explanation, setExplanation] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expandTasks, setExpandTasks] = useState(true);
  const started = useRef(false);

  // Timer
  useEffect(() => {
    if (phase === "done" || phase === "error") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const updateTask = (id: string, status: EditorTaskStatus, detail?: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, detail } : t)));
  };

  const addTask = (task: EditorTask) => {
    setTasks((prev) => [...prev, task]);
  };

  // ── Main execution ──
  const execute = useCallback(async () => {
    try {
      // 1. Call AI editor to decide what to do
      setPhase("analyzing");

      const projectState = existingProject
        ? {
            title: existingProject.title,
            aspectRatio: existingProject.aspectRatio,
            sceneCount: existingProject.scenes.length,
            scenes: existingProject.scenes.map((s, i) => ({
              index: i,
              narration: s.narration,
              duration: s.duration,
              hasImage: !!s.imageUrl,
              hasAudio: !!s.audioBase64,
              filters: s.filters,
              textOverlays: s.textOverlays.length,
              speed: s.speed,
              transition: s.transition,
            })),
          }
        : null;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/video-editor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMessage }],
          projectState,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI editor failed");

      updateTask("ai-decide", "done", "Decision made");

      const toolCalls = data.toolCalls || [];
      const aiText = data.text || "";

      if (toolCalls.length === 0) {
        // AI responded with text only (no edits needed)
        setExplanation(aiText || "No changes needed.");
        setPhase("done");
        return;
      }

      // 2. Process tool calls
      for (const call of toolCalls) {
        if (call.name === "generate_full_video") {
          await handleGenerateVideo(call.arguments);
        } else if (call.name === "edit_video") {
          await handleEditVideo(call.arguments);
        } else if (call.name === "analyze_video") {
          setExplanation(call.arguments.summary || "Analysis complete.");
          setPhase("done");
        }
      }
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }, [userMessage, existingProject]);

  // ── Generate full video ──
  const handleGenerateVideo = async (args: any) => {
    setPhase("generating");
    const { topic, duration, aspect_ratio, style } = args;

    // Script generation
    addTask({ id: "script", label: "Generate Script", status: "working" });
    const script = await generateVideoScript(topic, duration || 45, aspect_ratio || "9:16");
    updateTask("script", "done", `${script.scenes.length} scenes`);

    // Generate assets for each scene
    const sceneStates: SceneState[] = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const imgTaskId = `gen-img-${i}`;
      const ttsTaskId = `gen-tts-${i}`;
      addTask({ id: imgTaskId, label: `Scene ${i + 1} Image`, status: "pending" });
      addTask({ id: ttsTaskId, label: `Scene ${i + 1} Voice`, status: "pending" });
    }

    const assetResults = await Promise.all(
      script.scenes.map(async (scene, idx) => {
        updateTask(`gen-img-${idx}`, "working", "Generating...");
        updateTask(`gen-tts-${idx}`, "working", "Synthesizing...");

        const [imageUrl, audioBase64] = await Promise.all([
          generateSceneImage(scene.imagePrompt, aspect_ratio || "9:16").then((url) => {
            updateTask(`gen-img-${idx}`, "done", "Ready");
            return url;
          }).catch((e) => {
            updateTask(`gen-img-${idx}`, "error", e.message);
            throw e;
          }),
          generateTTS(scene.narration).then((audio) => {
            updateTask(`gen-tts-${idx}`, "done", "Ready");
            return audio;
          }).catch((e) => {
            updateTask(`gen-tts-${idx}`, "error", e.message);
            throw e;
          }),
        ]);

        return {
          imageUrl,
          audioBase64,
          narration: scene.narration,
          imagePrompt: scene.imagePrompt,
          duration: scene.duration,
          transition: scene.transition || "fade",
          filters: [],
          textOverlays: [],
          speed: 1.0,
        } as SceneState;
      })
    );

    const project: VideoProject = {
      title: script.title,
      scenes: assetResults,
      aspectRatio: aspect_ratio || "9:16",
    };

    onProjectUpdate?.(project);
    setExplanation(`Created "${script.title}" with ${script.scenes.length} scenes.`);

    // Render
    await handleRender(project);
  };

  // ── Apply edits ──
  const handleEditVideo = async (args: any) => {
    if (!existingProject) {
      throw new Error("No video project to edit. Create a video first.");
    }

    setPhase("editing");
    setExplanation(args.explanation || "Applying edits...");

    const operations = args.operations || [];
    
    // Add tasks for operations that need API calls
    const regenOps = operations.filter((op: any) =>
      op.type === "regenerate_image" || op.type === "regenerate_voice"
    );

    for (let i = 0; i < regenOps.length; i++) {
      const op = regenOps[i];
      const taskId = `regen-${i}`;
      addTask({
        id: taskId,
        label: op.type === "regenerate_image"
          ? `Regenerate Scene ${(op.sceneIndex ?? 0) + 1} Image`
          : `Regenerate Scene ${(op.sceneIndex ?? 0) + 1} Voice`,
        status: "working",
      });

      try {
        const sceneIdx = op.sceneIndex ?? 0;
        if (op.type === "regenerate_image" && op.params.newPrompt) {
          const newUrl = await generateSceneImage(op.params.newPrompt, existingProject.aspectRatio);
          existingProject.scenes[sceneIdx].imageUrl = newUrl;
          existingProject.scenes[sceneIdx].imagePrompt = op.params.newPrompt;
        } else if (op.type === "regenerate_voice" && op.params.newNarration) {
          const newAudio = await generateTTS(op.params.newNarration);
          existingProject.scenes[sceneIdx].audioBase64 = newAudio;
          existingProject.scenes[sceneIdx].narration = op.params.newNarration;
        }
        updateTask(taskId, "done");
      } catch (e: any) {
        updateTask(taskId, "error", e.message);
      }
    }

    // Apply non-API operations
    const nonApiOps = operations.filter((op: any) =>
      op.type !== "regenerate_image" && op.type !== "regenerate_voice"
    );
    const updatedProject = applyOperations(existingProject, nonApiOps);
    onProjectUpdate?.(updatedProject);

    // Render
    await handleRender(updatedProject);
  };

  // ── Render ──
  const handleRender = async (project: VideoProject) => {
    setPhase("rendering");

    const url = await renderProject(project, (progress) => {
      // Merge render tasks into our task list
      setTasks((prev) => {
        const nonRender = prev.filter(
          (t) => !t.id.startsWith("render-") && t.id !== "merge" && t.id !== "export"
        );
        return [...nonRender, ...progress.tasks];
      });
    });

    setVideoUrl(url);
    onVideoReady?.(url);
    setPhase("done");
  };

  // Start execution
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    execute();
  }, [execute]);

  // ── Render UI ──

  const phaseConfig = PHASE_CONFIG[phase];
  const PhaseIcon = phaseConfig.icon;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `edited_video_${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">AI Video Editor</span>
          <span className="ml-auto text-[11px] font-mono text-muted-foreground">
            {formatTime(elapsed)}
          </span>
        </div>
        {/* Phase indicator */}
        <div className="flex items-center gap-2 mt-2">
          {phase === "done" || phase === "error" ? (
            <PhaseIcon className={cn("w-3.5 h-3.5", phase === "done" ? "text-emerald-500" : "text-destructive")} />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-foreground animate-spin" />
          )}
          <span className="text-xs font-medium text-foreground">{phaseConfig.label}</span>
          {tasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {doneCount}/{tasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="relative bg-black">
          <video src={videoUrl} controls className="w-full max-h-[400px] object-contain" playsInline />
        </div>
      )}

      {/* Progress */}
      {phase !== "done" && phase !== "error" && tasks.length > 0 && (
        <div className="px-4 pt-3">
          <Progress value={Math.round((doneCount / tasks.length) * 100)} className="h-1.5" />
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="px-4 pt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="px-2 py-2">
          <button
            onClick={() => setExpandTasks(!expandTasks)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground flex-1 text-left">Tasks</span>
            <span className="text-[10px] text-muted-foreground">{doneCount}/{tasks.length}</span>
            {expandTasks ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )}
          </button>

          {expandTasks && (
            <div className="ml-3 mr-2 mt-1 space-y-px max-h-[200px] overflow-y-auto">
              {tasks.map((task) => {
                const TIcon = STATUS_ICON[task.status];
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                      task.status === "working" && "bg-accent/40",
                    )}
                  >
                    <TIcon
                      className={cn(
                        "w-3 h-3 shrink-0",
                        task.status === "done" && "text-emerald-500",
                        task.status === "working" && "text-foreground animate-spin",
                        task.status === "error" && "text-destructive",
                        task.status === "pending" && "text-muted-foreground/40",
                      )}
                    />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        task.status === "pending" && "text-muted-foreground/60",
                        task.status === "working" && "text-foreground font-medium",
                        task.status === "done" && "text-muted-foreground",
                        task.status === "error" && "text-destructive",
                      )}
                    >
                      {task.label}
                    </span>
                    {task.detail && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{task.detail}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          {error}
        </div>
      )}

      {/* Done */}
      {phase === "done" && videoUrl && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Rendered in {formatTime(elapsed)}
            </span>
          </div>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Download MP4
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoEditorCard;
