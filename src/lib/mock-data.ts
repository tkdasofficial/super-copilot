import { PenTool, Image, Search, Sparkles, Video, FileText, Clapperboard, Ghost, Zap, BookOpen, Palette, Flame, Lightbulb, Camera, Globe, Tag, BarChart3, Rocket, WandSparkles, Gamepad2, Plane, Briefcase, Package, ScanText, ClipboardList, TrendingUp, type LucideIcon } from "lucide-react";

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

export const AI_TOOLS: AITool[] = [
  {
    id: "script-writer",
    name: "AI Script Writer",
    shortName: "Script Writer",
    description: "Generate engaging video scripts with retention hooks",
    icon: PenTool,
    emptyStateTitle: "What script can I write for you?",
    emptyStateSubtitle: "Generate retention-optimized scripts for YouTube, shorts, stories & more.",
    samplePrompts: [
      { icon: Clapperboard, label: "YouTube script", prompt: "Write a 10-minute YouTube script about AI tools for creators" },
      { icon: Ghost, label: "Horror narration", prompt: "Create a horror story narration script with suspense hooks" },
      { icon: Zap, label: "Short-form script", prompt: "Generate a 60-second short-form script about productivity hacks" },
      { icon: BookOpen, label: "Educational video", prompt: "Write an educational explainer script about blockchain" },
    ],
  },
  {
    id: "thumbnail-designer",
    name: "AI Thumbnail Designer",
    shortName: "Thumbnails",
    description: "Create click-worthy thumbnail concepts",
    icon: Image,
    emptyStateTitle: "Let's design a thumbnail",
    emptyStateSubtitle: "Get optimized thumbnail prompts designed to maximize click-through rate.",
    samplePrompts: [
      { icon: Palette, label: "Tech review", prompt: "Design a thumbnail for a tech review video" },
      { icon: Flame, label: "Trending style", prompt: "Create a dramatic thumbnail concept for a mystery video" },
      { icon: Lightbulb, label: "MrBeast style", prompt: "Generate a thumbnail style based on MrBeast's format" },
      { icon: Camera, label: "Before/After", prompt: "Design a before/after transformation thumbnail" },
    ],
  },
  {
    id: "seo-optimizer",
    name: "AI SEO Optimizer",
    shortName: "SEO",
    description: "Optimize titles, descriptions & tags",
    icon: Search,
    emptyStateTitle: "Optimize your content for search",
    emptyStateSubtitle: "Generate SEO titles, descriptions, tags, and keywords for any platform.",
    samplePrompts: [
      { icon: Globe, label: "Video SEO", prompt: "Optimize SEO for a video about iPhone 16 review" },
      { icon: Tag, label: "Tags & keywords", prompt: "Generate tags and keywords for a cooking channel" },
      { icon: BarChart3, label: "Full SEO package", prompt: "Create a full SEO package for a fitness transformation video" },
      { icon: Rocket, label: "Channel growth", prompt: "Analyze and optimize SEO strategy for a tech channel" },
    ],
  },
  {
    id: "image-generator",
    name: "AI Image Creator",
    shortName: "Images",
    description: "Generate stunning visuals and graphics",
    icon: Sparkles,
    emptyStateTitle: "What visuals do you need?",
    emptyStateSubtitle: "Generate optimized prompts for thumbnails, social graphics, and illustrations.",
    samplePrompts: [
      { icon: WandSparkles, label: "Sci-fi landscape", prompt: "Generate an epic sci-fi landscape for a video background" },
      { icon: Sparkles, label: "Social graphic", prompt: "Create a social media graphic for a product launch" },
      { icon: Image, label: "Fantasy art", prompt: "Design an illustration for a fantasy story video" },
      { icon: Camera, label: "Blog header", prompt: "Generate a clean blog header image about AI technology" },
    ],
  },
  {
    id: "content-optimizer",
    name: "Content Optimizer",
    shortName: "Optimizer",
    description: "Full content optimization package",
    icon: Video,
    emptyStateTitle: "Get a complete content package",
    emptyStateSubtitle: "Script, SEO, thumbnail, tags, and strategy — all in one workflow.",
    samplePrompts: [
      { icon: Package, label: "Full package", prompt: "Create a full content package for a tech unboxing video" },
      { icon: Gamepad2, label: "Gaming content", prompt: "Optimize my entire channel strategy for gaming content" },
      { icon: Plane, label: "Travel vlog", prompt: "Generate a complete video package for a travel vlog" },
      { icon: Briefcase, label: "Business content", prompt: "Create an optimized content plan for a business channel" },
    ],
  },
  {
    id: "content-analyzer",
    name: "Content Analyzer",
    shortName: "Analyzer",
    description: "Analyze and improve existing content",
    icon: FileText,
    emptyStateTitle: "Analyze & improve your content",
    emptyStateSubtitle: "Upload scripts, thumbnails, or descriptions for AI-powered improvement.",
    samplePrompts: [
      { icon: ScanText, label: "Script review", prompt: "Analyze my script and suggest retention improvements" },
      { icon: Image, label: "Thumbnail review", prompt: "Review my thumbnail and suggest click-rate improvements" },
      { icon: ClipboardList, label: "Description check", prompt: "Evaluate my video description for SEO strength" },
      { icon: TrendingUp, label: "Performance tips", prompt: "Analyze my content strategy and suggest growth improvements" },
    ],
  },
];

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
  structuredOutput?: StructuredOutput;
};

export type StructuredOutput = {
  sections: { title: string; content: string; type: "text" | "list" | "code" }[];
};

export const MOCK_RESPONSE: StructuredOutput = {
  sections: [
    {
      title: "Video Script",
      type: "text",
      content: `**HOOK (0:00 - 0:15)**\n"What if I told you that 90% of creators are wasting hours on tasks that AI can do in seconds? These 5 tools are about to change your entire workflow."\n\n**INTRO (0:15 - 0:45)**\nHey everyone! Today we're diving into the 5 AI tools that are completely transforming the creator economy in 2026.\n\n**TOOL #1 — AI Script Generators (0:45 - 1:30)**\nModern script AI understands viewer retention patterns, hook structures, and audience psychology...\n\n**TOOL #2 — AI Thumbnail Designers (1:30 - 2:15)**\nAI tools can now analyze trending thumbnail patterns and generate concepts designed to maximize CTR...\n\n**TOOL #3 — AI SEO Optimizers (2:15 - 3:00)**\nAI SEO tools now generate optimized titles, descriptions, and tags in seconds...\n\n**CTA & OUTRO (4:30 - 5:00)**\n"Smash that like button and subscribe for more creator tools breakdowns!"`,
    },
    {
      title: "SEO Title",
      type: "text",
      content: "5 AI Tools Every Creator NEEDS in 2026 (Game Changers!)",
    },
    {
      title: "Video Description",
      type: "text",
      content: "Discover the top 5 AI tools transforming the creator economy in 2026. From script writers to thumbnail designers.\n\nTimestamps:\n0:00 - Hook\n0:45 - AI Script Generators\n1:30 - AI Thumbnail Designers\n2:15 - AI SEO Optimizers\n3:00 - AI Video Editors\n4:30 - Outro",
    },
    {
      title: "Keywords",
      type: "list",
      content: "ai tools for creators, ai content creation 2026, youtube ai tools, best ai tools, creator economy, ai script writer, ai thumbnail, content creator tools, youtube growth",
    },
    {
      title: "Thumbnail Concept",
      type: "text",
      content: "**Style:** Bold text with high contrast\n**Text:** \"5 AI TOOLS\" in large white text\n**Background:** Dark gradient\n**Subject:** Creator looking amazed at floating UI\n**Colors:** Black, White, subtle accent",
    },
  ],
};

// Mock text-only response for general chat
export const MOCK_TEXT_RESPONSE = "Great question! Here are some strategies that are working really well for creators right now:\n\n**1. Consistency over perfection** — Post regularly, even if it's not perfect. The algorithm rewards consistency.\n\n**2. Short-form to long-form pipeline** — Use Shorts/Reels to drive traffic to your longer content.\n\n**3. Community engagement** — Reply to every comment in the first hour. This signals to the algorithm that your content is engaging.\n\n**4. Trend-jacking with a twist** — Don't just follow trends, add your unique perspective.\n\n**5. Collaborate strategically** — Partner with creators who have a similar audience size but different content focus.\n\nWould you like me to dive deeper into any of these strategies?";
