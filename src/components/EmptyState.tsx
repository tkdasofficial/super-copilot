import { useState } from "react";
import { Zap, PenTool, Lightbulb, BarChart3, ChevronRight, ArrowLeft } from "lucide-react";
import type { AITool, SamplePrompt } from "@/lib/types";
import { STUDIO_CATEGORIES, type StudioCategory, type WorkflowPreset } from "@/lib/workflow-presets";
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
  const [selectedStudio, setSelectedStudio] = useState<StudioCategory | null>(null);

  if (tool) {
    const prompts = tool.samplePrompts;
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 animate-fade-up">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-6 animate-spin-slow">
          <img src={logo} alt="Super Copilot" className="w-full h-full object-cover" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground text-center mb-1.5">
          {tool.emptyStateTitle}
        </h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm mb-8">
          {tool.emptyStateSubtitle}
        </p>
        <div className="w-full max-w-md grid grid-cols-2 gap-2">
          {prompts.map((sp, i) => {
            const Icon = sp.icon;
            return (
              <button key={i} onClick={() => onPromptClick(sp.prompt)} className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left group">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground leading-tight">{sp.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Studio workflow detail view
  if (selectedStudio) {
    return (
      <div className="flex flex-col h-full px-5 py-6 animate-fade-up">
        <button
          onClick={() => setSelectedStudio(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 self-start transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to studios
        </button>

        <div className="flex items-center gap-3 mb-2">
          <selectedStudio.icon className={`w-6 h-6 ${selectedStudio.color}`} />
          <h2 className="font-display text-xl font-semibold text-foreground">{selectedStudio.name}</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">{selectedStudio.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl">
          {selectedStudio.workflows.map((wf) => {
            const WfIcon = wf.icon;
            return (
              <button
                key={wf.id}
                onClick={() => onPromptClick(wf.prompt)}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/20 transition-all text-left group"
              >
                <WfIcon className={`w-5 h-5 mt-0.5 shrink-0 ${selectedStudio.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{wf.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{wf.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-foreground/60 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Main empty state with studios
  return (
    <div className="flex flex-col items-center justify-center h-full px-5 animate-fade-up">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden mb-5 animate-spin-slow">
        <img src={logo} alt="Super Copilot" className="w-full h-full object-cover" />
      </div>
      <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground text-center mb-1">
        What can I help you with?
      </h2>
      <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
        Choose a studio or just start typing.
      </p>

      {/* Quick prompts */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-2 mb-6">
        {GENERAL_PROMPTS.map((sp, i) => {
          const Icon = sp.icon;
          return (
            <button key={i} onClick={() => onPromptClick(sp.prompt)} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left">
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground leading-tight">{sp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Studio categories grid */}
      <div className="w-full max-w-2xl">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2.5 px-1">
          AI Studios
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STUDIO_CATEGORIES.map((studio) => {
            const Icon = studio.icon;
            return (
              <button
                key={studio.id}
                onClick={() => setSelectedStudio(studio)}
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/20 transition-all group"
              >
                <Icon className={`w-5 h-5 ${studio.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <span className="text-xs font-medium text-foreground text-center leading-tight">{studio.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
