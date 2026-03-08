import { useState, useMemo } from "react";
import { Zap, PenTool, Lightbulb, BarChart3, ChevronRight, ArrowLeft,
  Video, Code2, FileText, Search, FolderOpen, Briefcase, User,
  Youtube, Image, Podcast, Globe, Database, Presentation, Brain,
  Workflow, Bot, Mic, Palette, Mail, Calendar, Store,
  Smartphone, Target, Layout, Rocket, Shield, Sparkles,
  type LucideIcon
} from "lucide-react";
import type { AITool, SamplePrompt } from "@/lib/types";
import { STUDIO_CATEGORIES, type StudioCategory } from "@/lib/workflow-presets";
import logo from "@/assets/logo.svg";

type Props = {
  tool?: AITool;
  onPromptClick: (prompt: string) => void;
};

type FeatureItem = { icon: LucideIcon; label: string; prompt: string };

const MARQUEE_ROWS: FeatureItem[][] = [
  [
    { icon: Video, label: "Video Generator", prompt: "Generate a professional video for me" },
    { icon: Code2, label: "App Builder", prompt: "Build a full-stack web application" },
    { icon: Image, label: "Image Creator", prompt: "Create a professional image" },
    { icon: FileText, label: "Document Writer", prompt: "Write a professional document" },
    { icon: Brain, label: "Research Assistant", prompt: "Help me research a topic in depth" },
    { icon: Podcast, label: "Podcast Creator", prompt: "Create a podcast episode" },
    { icon: Globe, label: "Website Builder", prompt: "Build a modern website" },
    { icon: Palette, label: "UI Designer", prompt: "Design a modern UI for a web application" },
    { icon: Target, label: "Marketing Copy", prompt: "Write marketing copy for my product" },
    { icon: Bot, label: "AI Agent", prompt: "Create an AI agent to automate my workflow" },
    { icon: Database, label: "Schema Designer", prompt: "Design a database schema" },
    { icon: Youtube, label: "YouTube Package", prompt: "Generate a complete YouTube video package" },
  ],
  [
    { icon: Presentation, label: "Slide Deck", prompt: "Create a professional presentation" },
    { icon: Mic, label: "Text to Speech", prompt: "Convert text to natural speech" },
    { icon: Workflow, label: "Automation", prompt: "Build an automated workflow" },
    { icon: Mail, label: "Email Campaign", prompt: "Create an email marketing campaign" },
    { icon: Smartphone, label: "Mobile App", prompt: "Design a mobile app interface" },
    { icon: Layout, label: "Landing Page", prompt: "Build a high-converting landing page" },
    { icon: Briefcase, label: "Business Plan", prompt: "Write a comprehensive business plan" },
    { icon: Search, label: "SEO Optimizer", prompt: "Optimize my content for SEO" },
    { icon: Calendar, label: "Content Planner", prompt: "Create a content calendar for my brand" },
    { icon: Store, label: "Product Page", prompt: "Design a product page" },
    { icon: Rocket, label: "Deploy Assistant", prompt: "Help me deploy my application" },
    { icon: FolderOpen, label: "File Converter", prompt: "Convert my files to another format" },
  ],
  [
    { icon: User, label: "Resume Builder", prompt: "Create a professional resume" },
    { icon: Shield, label: "Code Review", prompt: "Review and optimize my code" },
    { icon: Sparkles, label: "Thumbnail Gen", prompt: "Generate eye-catching thumbnails" },
    { icon: Lightbulb, label: "Idea Generator", prompt: "Brainstorm creative ideas" },
    { icon: BarChart3, label: "Data Analyzer", prompt: "Analyze data and create visualizations" },
    { icon: PenTool, label: "Blog Writer", prompt: "Write a compelling blog post" },
    { icon: Globe, label: "Chrome Extension", prompt: "Build a Chrome extension" },
    { icon: Video, label: "Shorts Creator", prompt: "Create viral short-form video content" },
    { icon: FileText, label: "Legal Docs", prompt: "Generate a legal document" },
    { icon: Brain, label: "Fact Checker", prompt: "Verify facts and claims" },
    { icon: Zap, label: "Quick Task", prompt: "Help me with a quick task" },
    { icon: Code2, label: "API Builder", prompt: "Build a REST API" },
  ],
];

const QUICK_PROMPTS: SamplePrompt[] = [
  { icon: Zap, label: "Quick idea", prompt: "Help me brainstorm content ideas for my channel" },
  { icon: PenTool, label: "Write something", prompt: "Help me write a compelling social media post" },
  { icon: Lightbulb, label: "Get advice", prompt: "What are the best strategies for growing on YouTube in 2026?" },
  { icon: BarChart3, label: "Analyze trends", prompt: "What content trends are working right now?" },
];

/* ── Marquee row component ── */
const MarqueeRow = ({
  items,
  direction,
  speed = 35,
  onPromptClick,
}: {
  items: FeatureItem[];
  direction: "left" | "right";
  speed?: number;
  onPromptClick: (p: string) => void;
}) => {
  // Duplicate items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="relative w-full overflow-hidden py-1">
      <div
        className={`flex gap-2 w-max ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={`${item.label}-${i}`}
              onClick={() => onPromptClick(item.prompt)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-border bg-card hover:bg-accent hover:border-foreground/10 transition-all whitespace-nowrap group shrink-0"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

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

  // Studio detail view
  if (selectedStudio) {
    return (
      <div className="flex flex-col h-full px-5 py-6 animate-fade-up">
        <button
          onClick={() => setSelectedStudio(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 self-start transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
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
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-accent hover:border-foreground/10 transition-all text-left group"
              >
                <WfIcon className={`w-5 h-5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors`} />
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

  // Main empty state
  return (
    <div className="flex flex-col items-center justify-center h-full px-0 animate-fade-up overflow-hidden">
      {/* Hero */}
      <div className="flex flex-col items-center mb-8 px-5">
        <div className="w-12 h-12 rounded-full overflow-hidden mb-4 animate-spin-slow">
          <img src={logo} alt="Super Copilot" className="w-full h-full object-cover" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground text-center mb-1">
          What can I help you create?
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm text-center max-w-sm">
          Type anything or pick a feature below
        </p>
      </div>

      {/* Quick action pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 px-5 max-w-lg">
        {QUICK_PROMPTS.map((sp, i) => {
          const Icon = sp.icon;
          return (
            <button
              key={i}
              onClick={() => onPromptClick(sp.prompt)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-accent transition-colors group"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-xs text-foreground">{sp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Marquee feature rows */}
      <div className="w-full space-y-1.5 mb-8">
        {MARQUEE_ROWS.map((row, i) => (
          <MarqueeRow
            key={i}
            items={row}
            direction={i % 2 === 0 ? "left" : "right"}
            speed={40 + i * 5}
            onPromptClick={onPromptClick}
          />
        ))}
      </div>

      {/* Studio categories – minimal row */}
      <div className="px-5 w-full max-w-2xl">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-1">
          Studios
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_CATEGORIES.map((studio) => {
            const Icon = studio.icon;
            return (
              <button
                key={studio.id}
                onClick={() => setSelectedStudio(studio)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent hover:border-foreground/10 transition-all text-xs text-muted-foreground hover:text-foreground group"
              >
                <Icon className="w-3 h-3" />
                {studio.shortName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
