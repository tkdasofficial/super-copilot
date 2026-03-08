import { useState } from "react";
import { useLocation } from "react-router-dom";
import { type AITool } from "@/lib/mock-data";
import { useChatHistory } from "@/context/ChatHistoryContext";
import DesktopSidebar from "@/components/DesktopSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ChatWorkspace from "@/components/ChatWorkspace";
import ProfileMenu from "@/components/ProfileMenu";

const Index = () => {
  const location = useLocation();
  const state = location.state as any;
  const initialChatId = state?.chatId;

  const { getChatById, history } = useChatHistory();

  const loadedChat = initialChatId ? getChatById(initialChatId) : undefined;

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(initialChatId);

  const handleNewChat = () => {
    setSelectedTool(undefined);
    setActiveChatId(undefined);
    setChatKey((k) => k + 1);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setSelectedTool(undefined);
    setChatKey((k) => k + 1);
    setSidebarOpen(false);
  };

  const activeChat = activeChatId ? getChatById(activeChatId) : loadedChat;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <DesktopSidebar
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        activeChatId={activeChatId}
      />
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        activeChatId={activeChatId}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWorkspace
          key={chatKey}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
          initialMessages={activeChat?.messages}
          chatId={activeChatId}
        />
      </main>
    </div>
  );
};

export default Index;
