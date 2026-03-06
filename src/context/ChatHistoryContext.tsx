import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ChatHistoryItem = {
  id: string;
  title: string;
  toolId?: string;
  preview: string;
  date: string;
  createdAt: number;
};

type ChatHistoryContextType = {
  history: ChatHistoryItem[];
  addChat: (title: string, preview: string, toolId?: string) => string;
  renameChat: (id: string, newTitle: string) => void;
  deleteChat: (id: string) => void;
  searchHistory: (query: string) => ChatHistoryItem[];
};

const ChatHistoryContext = createContext<ChatHistoryContextType | null>(null);

const getDateLabel = (ts: number): string => {
  const now = new Date();
  const d = new Date(ts);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const INITIAL_HISTORY: ChatHistoryItem[] = [
  { id: "1", title: "AI tools for creators script", toolId: "script-writer", preview: "Write a 10-minute YouTube script about AI tools", date: "Today", createdAt: Date.now() - 3600000 },
  { id: "2", title: "Tech review thumbnail", toolId: "thumbnail-designer", preview: "Design a thumbnail for a tech review video", date: "Today", createdAt: Date.now() - 7200000 },
  { id: "3", title: "Gaming channel SEO", toolId: "seo-optimizer", preview: "Optimize SEO for my gaming channel", date: "Yesterday", createdAt: Date.now() - 90000000 },
  { id: "4", title: "Horror story narration", toolId: "script-writer", preview: "Create a horror story narration script with suspense hooks", date: "Yesterday", createdAt: Date.now() - 100000000 },
  { id: "5", title: "Productivity hacks short", toolId: "content-optimizer", preview: "Generate a full content package for productivity", date: "Mar 4", createdAt: Date.now() - 200000000 },
  { id: "6", title: "Blockchain explainer", toolId: "script-writer", preview: "Write an educational explainer script about blockchain", date: "Mar 3", createdAt: Date.now() - 300000000 },
  { id: "7", title: "Fitness transformation SEO", toolId: "seo-optimizer", preview: "Create a full SEO package for a fitness video", date: "Mar 2", createdAt: Date.now() - 400000000 },
  { id: "8", title: "Fantasy story illustrations", toolId: "image-generator", preview: "Design an illustration for a fantasy story video", date: "Mar 1", createdAt: Date.now() - 500000000 },
];

export const ChatHistoryProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>(INITIAL_HISTORY);

  const addChat = useCallback((title: string, preview: string, toolId?: string) => {
    const id = Date.now().toString();
    const item: ChatHistoryItem = {
      id,
      title,
      preview,
      toolId,
      date: getDateLabel(Date.now()),
      createdAt: Date.now(),
    };
    setHistory((prev) => [item, ...prev]);
    return id;
  }, []);

  const renameChat = useCallback((id: string, newTitle: string) => {
    setHistory((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
  }, []);

  const deleteChat = useCallback((id: string) => {
    setHistory((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const searchHistory = useCallback(
    (query: string) => {
      if (!query.trim()) return history;
      const q = query.toLowerCase();
      return history.filter(
        (c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
      );
    },
    [history]
  );

  return (
    <ChatHistoryContext.Provider value={{ history, addChat, renameChat, deleteChat, searchHistory }}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error("useChatHistory must be used within ChatHistoryProvider");
  return ctx;
};
