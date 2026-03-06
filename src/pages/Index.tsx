import { useState } from "react";
import { useLocation } from "react-router-dom";
import { AI_TOOLS, type AITool } from "@/lib/mock-data";
import { useChatHistory } from "@/context/ChatHistoryContext";
import DesktopSidebar from "@/components/DesktopSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ChatWorkspace from "@/components/ChatWorkspace";
import ProfileMenu from "@/components/ProfileMenu";

const Index = () => {
  const location = useLocation();
  const initialToolId = (location.state as any)?.toolId;
  const initialTool = initialToolId ? AI_TOOLS.find((t) => t.id === initialToolId) : undefined;

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(initialTool);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const { history } = useChatHistory();

  const handleNewChat = () => {
    setSelectedTool(undefined);
    setChatKey((k) => k + 1);
  };

  const recentHistory = history.slice(0, 5);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-background">
      <DesktopSidebar
        onNewChat={handleNewChat}
        isMainChat={!selectedTool}
        chatHistory={recentHistory}
      />

      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        isMainChat={!selectedTool}
        chatHistory={recentHistory}
      />

      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <div className="absolute top-2.5 right-3 z-30 sm:top-3 sm:right-4">
          <ProfileMenu />
        </div>
        <ChatWorkspace
          key={`${selectedTool?.id ?? "main"}-${chatKey}`}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
        />
      </div>
    </div>
  );
};

export default Index;
