import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/types";

export type ChatHistoryItem = {
  id: string;
  title: string;
  toolId?: string;
  preview: string;
  date: string;
  createdAt: number;
  messages: ChatMessage[];
};

type ChatHistoryContextType = {
  history: ChatHistoryItem[];
  addChat: (title: string, preview: string, toolId?: string) => string;
  renameChat: (id: string, newTitle: string) => void;
  deleteChat: (id: string) => void;
  searchHistory: (query: string) => ChatHistoryItem[];
  updateChatMessages: (id: string, messages: ChatMessage[]) => void;
  getChatById: (id: string) => ChatHistoryItem | undefined;
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

export const ChatHistoryProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);

  const addChat = useCallback((title: string, preview: string, toolId?: string) => {
    const id = Date.now().toString();
    const item: ChatHistoryItem = {
      id,
      title,
      preview,
      toolId,
      date: getDateLabel(Date.now()),
      createdAt: Date.now(),
      messages: [],
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

  const updateChatMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setHistory((prev) => prev.map((c) => (c.id === id ? { ...c, messages } : c)));
  }, []);

  const getChatById = useCallback((id: string) => {
    return history.find((c) => c.id === id);
  }, [history]);

  return (
    <ChatHistoryContext.Provider value={{ history, addChat, renameChat, deleteChat, searchHistory, updateChatMessages, getChatById }}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = () => {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error("useChatHistory must be used within ChatHistoryProvider");
  return ctx;
};
