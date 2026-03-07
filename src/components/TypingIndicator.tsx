import { useState, useEffect } from "react";
import logo from "@/assets/logo.svg";

export type ThinkingPhase = "thinking" | "creating" | "analyzing" | "working" | "researching" | "writing" | "optimizing";

const PHASE_LABELS: Record<ThinkingPhase, string> = {
  thinking: "Thinking",
  creating: "Creating",
  analyzing: "Analyzing",
  working: "Working",
  researching: "Researching",
  writing: "Writing",
  optimizing: "Optimizing",
};

type Props = {
  phase?: ThinkingPhase;
  isStreaming?: boolean;
};

const TypingIndicator = ({ phase = "thinking", isStreaming = false }: Props) => {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const label = PHASE_LABELS[phase] || "Thinking";
  const dotStr = ".".repeat(dots);

  return (
    <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto animate-fade-in">
      <div className="w-7 h-7 rounded-full overflow-hidden animate-spin-slow shrink-0">
        <img src={logo} alt="AI" className="w-full h-full object-cover" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground font-medium min-w-[100px]">
          {label}{dotStr}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;

export function detectPhase(content: string, toolId?: string): ThinkingPhase {
  const lower = content.toLowerCase();
  
  if (/\b(generate|create|make|draw|design)\b.*\b(image|picture|photo|illustration|graphic|visual|thumbnail|art)\b/.test(lower)) {
    return "creating";
  }
  if (/\b(analy[sz]e|review|evaluate|assess|compare)\b/.test(lower)) {
    return "analyzing";
  }
  if (/\b(research|find|search|look up|discover)\b/.test(lower)) {
    return "researching";
  }
  if (/\b(write|script|draft|compose|blog|article|story)\b/.test(lower)) {
    return "writing";
  }
  if (/\b(optimi[sz]e|seo|improve|enhance|boost)\b/.test(lower)) {
    return "optimizing";
  }
  
  if (toolId === "script-writer") return "writing";
  if (toolId === "thumbnail-designer") return "creating";
  if (toolId === "seo-optimizer") return "optimizing";
  if (toolId === "image-generator") return "creating";
  if (toolId === "content-optimizer") return "optimizing";
  if (toolId === "content-analyzer") return "analyzing";
  
  return "thinking";
}
