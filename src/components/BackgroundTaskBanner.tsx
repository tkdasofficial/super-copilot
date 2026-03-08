import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import type { BackgroundTask } from "@/hooks/useBackgroundTasks";
import { cn } from "@/lib/utils";

type Props = {
  task: BackgroundTask;
  onResult?: (task: BackgroundTask) => void;
};

const STATUS_CONFIG = {
  pending: { icon: Clock, label: "Queued", color: "text-muted-foreground" },
  running: { icon: Loader2, label: "Processing", color: "text-primary" },
  done: { icon: CheckCircle2, label: "Complete", color: "text-green-500" },
  error: { icon: XCircle, label: "Failed", color: "text-destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  chat: "AI Response",
  image: "Image Generation",
  code: "Code Generation",
  file: "File Creation",
  agent: "Multi-step Plan",
  video: "Video Generation",
};

export default function BackgroundTaskBanner({ task, onResult }: Props) {
  const [prevStatus, setPrevStatus] = useState(task.status);
  const config = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  useEffect(() => {
    if (prevStatus !== "done" && task.status === "done" && onResult) {
      onResult(task);
    }
    setPrevStatus(task.status);
  }, [task.status]);

  if (task.status === "done" || task.status === "error") return null;

  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 animate-in fade-in slide-in-from-top-2">
      <Icon className={cn("w-4 h-4 shrink-0", config.color, task.status === "running" && "animate-spin")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Zap className="w-3 h-3 text-primary" />
          <span>{TYPE_LABELS[task.task_type] || "Background Task"}</span>
          <span className={cn("text-xs", config.color)}>• {config.label}</span>
        </div>
        {task.progress > 0 && task.progress < 100 && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{task.progress}%</span>
    </div>
  );
}
