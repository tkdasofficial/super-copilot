import { useState, useEffect, useCallback } from "react";
import { Download, Play, Film, Sparkles, Volume2, Clapperboard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { runVideoPipeline, type PipelineProgress, type PipelineStage } from "@/lib/video-pipeline";

type Props = {
  topic: string;
  duration: number;
  aspectRatio: string;
};

const STAGE_CONFIG: Record<PipelineStage, { icon: typeof Film; label: string; color: string }> = {
  idle: { icon: Film, label: "Preparing...", color: "text-muted-foreground" },
  generating_script: { icon: Sparkles, label: "Writing Script", color: "text-amber-500" },
  generating_assets: { icon: Volume2, label: "Creating Assets", color: "text-blue-500" },
  assembling_video: { icon: Clapperboard, label: "Assembling Video", color: "text-purple-500" },
  done: { icon: CheckCircle2, label: "Complete!", color: "text-emerald-500" },
  error: { icon: AlertCircle, label: "Failed", color: "text-destructive" },
};

const VideoGenerationCard = ({ topic, duration, aspectRatio }: Props) => {
  const [progress, setProgress] = useState<PipelineProgress>({
    stage: "idle",
    progress: 0,
    message: "Initializing...",
  });
  const [started, setStarted] = useState(false);

  const handleProgress = useCallback((p: PipelineProgress) => {
    setProgress(p);
  }, []);

  useEffect(() => {
    if (started) return;
    setStarted(true);
    runVideoPipeline(topic, duration, aspectRatio, handleProgress).catch(() => {});
  }, [topic, duration, aspectRatio, handleProgress, started]);

  const { stage, message, videoUrl, script, error } = progress;
  const config = STAGE_CONFIG[stage];
  const StageIcon = config.icon;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${(script?.title || topic).replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
    a.click();
  };

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Film className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Video Generation</span>
        <span className="ml-auto text-xs text-muted-foreground">{duration}s • {aspectRatio}</span>
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="relative bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-[400px] object-contain"
            playsInline
          />
        </div>
      )}

      {/* Progress */}
      <div className="px-4 py-3 space-y-3">
        {/* Stage indicator */}
        <div className="flex items-center gap-2">
          {stage === "done" || stage === "error" ? (
            <StageIcon className={`w-4 h-4 ${config.color}`} />
          ) : (
            <Loader2 className={`w-4 h-4 ${config.color} animate-spin`} />
          )}
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>

        {/* Progress bar */}
        {stage !== "done" && stage !== "error" && (
          <Progress value={progress.progress} className="h-1.5" />
        )}

        {/* Status message */}
        <p className="text-xs text-muted-foreground">{message}</p>

        {/* Script preview */}
        {script && stage !== "done" && (
          <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg px-3 py-2">
            <span className="font-medium text-foreground">{script.title}</span>
            <span className="ml-2">• {script.scenes.length} scenes</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Download button */}
        {videoUrl && (
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Download MP4
          </button>
        )}
      </div>

      {/* Pipeline stages summary */}
      {stage !== "idle" && (
        <div className="px-4 pb-3 flex gap-1">
          {(["generating_script", "generating_assets", "assembling_video", "done"] as PipelineStage[]).map((s) => {
            const isActive = s === stage;
            const isPast =
              ["generating_script", "generating_assets", "assembling_video", "done"].indexOf(stage) >
              ["generating_script", "generating_assets", "assembling_video", "done"].indexOf(s);
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  isPast || isActive ? "bg-foreground" : "bg-border"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VideoGenerationCard;
