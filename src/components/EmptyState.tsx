import { Zap, PenTool, Lightbulb, BarChart3 } from "lucide-react";
import type { AITool, SamplePrompt } from "@/lib/types";
import logo from "@/assets/logo.svg";

type Props = {
  tool?: AITool;
  onPromptClick: (prompt: string) => void;
};

const GENERAL_PROMPTS: SamplePrompt[] = [
  { icon: Zap, label: "Quick idea", prompt: "Help me brainstorm content ideas for my channel" },
  { icon: PenTool, label: "Write something", prompt: "Help me write a compelling social media post" },
  { icon: Lightbulb, label: "Get advice", prompt: "What are the best strategies for growing on YouTube in 2026?" },
  { icon: BarChart3, label: "Analyze trends", prompt: "What content trends are working right now?" },
];

const EmptyState = ({ tool, onPromptClick }: Props) => {
  const prompts: SamplePrompt[] = tool ? tool.samplePrompts : GENERAL_PROMPTS;
  const title = tool ? tool.emptyStateTitle : "What can I help you with?";
  const subtitle = tool
    ? tool.emptyStateSubtitle
    : "Chat with Super Copilot or explore specialized AI tools.";

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 animate-fade-up">
      {/* Rotating Logo */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-6 animate-spin-slow">
        <img src={logo} alt="Super Copilot" className="w-full h-full object-cover" />
      </div>

      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground text-center mb-1.5">
        {title}
      </h2>
      <p className="text-muted-foreground text-sm text-center max-w-sm mb-8">
        {subtitle}
      </p>

      {/* Suggestion chips — 2 column grid */}
      <div className="w-full max-w-md grid grid-cols-2 gap-2">
        {prompts.map((sp, i) => {
          const Icon = sp.icon;
          return (
            <button
              key={i}
              onClick={() => onPromptClick(sp.prompt)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left group"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground leading-tight">{sp.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmptyState;
