import { useState, useEffect } from "react";
import logo from "@/assets/logo.svg";

const TASK_LABELS = ["Thinking", "Researching", "Creating", "Analyzing", "Optimizing"];

type Props = {
  onComplete?: () => void;
};

const TypingIndicator = ({ onComplete }: Props) => {
  const [taskIndex, setTaskIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaskIndex((prev) => {
        if (prev < TASK_LABELS.length - 1) return prev + 1;
        return prev;
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2 px-4 py-3 max-w-2xl mx-auto animate-fade-in">
      {/* Slim horizontal line */}
      <div className="w-full h-px bg-border mb-1" />

      <div className="flex items-center gap-3">
        {/* Rotating logo */}
        <div className="w-7 h-7 rounded-full overflow-hidden animate-spin-slow shrink-0">
          <img src={logo} alt="AI" className="w-full h-full object-cover" />
        </div>

        {/* Task label + dots */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium animate-fade-in" key={taskIndex}>
            {TASK_LABELS[taskIndex]}
          </span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-typing-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
