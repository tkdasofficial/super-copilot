import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { type AITool } from "@/lib/types";
import { useChatHistory } from "@/context/ChatHistoryContext";
import DesktopSidebar from "@/components/DesktopSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ChatWorkspace from "@/components/ChatWorkspace";

const Index = () => {
  const location = useLocation();
  const state = location.state as any;
  const initialChatId = state?.chatId;

  const { getChatById, history, loadChatMessages } = useChatHistory();

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(initialChatId);
  const [loadedMessages, setLoadedMessages] = useState<any[] | undefined>(undefined);

  const handleNewChat = () => {
    setSelectedTool(undefined);
    setActiveChatId(undefined);
    setLoadedMessages(undefined);
    setChatKey((k) => k + 1);
  };

  const handleSelectChat = useCallback(async (id: string) => {
    setActiveChatId(id);
    // Load messages from DB
    const msgs = await loadChatMessages(id);
    setLoadedMessages(msgs);
    setChatKey((k) => k + 1);
  }, [loadChatMessages]);

  const activeChat = activeChatId ? getChatById(activeChatId) : undefined;
  const initialMessages = loadedMessages || activeChat?.messages;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <DesktopSidebar
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        isMainChat={!selectedTool && !activeChatId}
        activeChatId={activeChatId}
        chatHistory={history}
      />
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        isMainChat={!selectedTool && !activeChatId}
        activeChatId={activeChatId}
        chatHistory={history}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWorkspace
          key={chatKey}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
          initialMessages={initialMessages && initialMessages.length > 0 ? initialMessages : undefined}
          chatId={activeChatId}
        />
      </main>
    </div>
  );
};

export default Index;
