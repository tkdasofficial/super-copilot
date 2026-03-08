import { useState, useRef, useEffect } from "react";
import { Plus, MessageSquare, Brain, Code, Paintbrush, Hammer, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskMode = "general" | "thinking" | "coding" | "creating" | "building";

type TaskModeOption = {
  id: TaskMode;
  label: string;
  icon: React.ElementType;
  description: string;
};

const TASK_MODES: TaskModeOption[] = [
  { id: "general", label: "General", icon: MessageSquare, description: "General conversation" },
  { id: "thinking", label: "Thinking", icon: Brain, description: "Deep reasoning & analysis" },
  { id: "coding", label: "Coding", icon: Code, description: "Write & debug code" },
  { id: "creating", label: "Creating", icon: Paintbrush, description: "Generate images & content" },
  { id: "building", label: "Building", icon: Hammer, description: "Build apps & features" },
];

type Props = {
  selectedMode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
};

const TaskModeSelector = ({ selectedMode, onModeChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentMode = TASK_MODES.find((m) => m.id === selectedMode) || TASK_MODES[0];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          isOpen
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        title={`Mode: ${currentMode.label}`}
      >
        <Plus className={cn("w-[18px] h-[18px] transition-transform", isOpen && "rotate-45")} />
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          className="absolute bottom-full left-0 mb-2 w-52 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Select task mode</p>
          </div>
          <div className="p-1.5">
            {TASK_MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = mode.id === selectedMode;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onModeChange(mode.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{mode.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{mode.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskModeSelector;
