import { type LucideIcon } from "lucide-react";

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

export type StockVideo = {
  id: number;
  url: string;
  image: string;
  duration: number;
  width: number;
  height: number;
  user: { name: string; url: string };
  videoUrl: string;
  previewUrl: string;
};

export type VideoGeneration = {
  topic: string;
  duration: number;
  aspectRatio: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolId?: string;
  imageUrl?: string;
  videos?: StockVideo[];
  videoGeneration?: VideoGeneration;
};
