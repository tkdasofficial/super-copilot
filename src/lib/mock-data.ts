import { Zap, PenTool, Lightbulb, BarChart3, type LucideIcon } from "lucide-react";

export type SamplePrompt = { icon: LucideIcon; label: string; prompt: string };

export type AITool = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  emptyStateTitle: string;
  emptyStateSubtitle: string;
  samplePrompts: SamplePrompt[];
};

// General chat prompts for main chat screen
export const GENERAL_CHAT_PROMPTS: SamplePrompt[] = [
  { icon: Zap, label: "Quick idea", prompt: "Help me brainstorm content ideas for my channel" },
  { icon: PenTool, label: "Write something", prompt: "Help me write a compelling social media post" },
  { icon: Lightbulb, label: "Get advice", prompt: "What are the best strategies for growing on YouTube in 2026?" },
  { icon: BarChart3, label: "Analyze trends", prompt: "What content trends are working right now?" },
];

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolId?: string;
  imageUrl?: string;
};
