import { useState } from "react";
import { useLocation } from "react-router-dom";
import { AI_TOOLS, type AITool } from "@/lib/mock-data";
import DesktopSidebar from "@/components/DesktopSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ChatWorkspace from "@/components/ChatWorkspace";
import ProfileMenu from "@/components/ProfileMenu";

const MOCK_HISTORY = [
  { id: "1", title: "AI tools for creators script", toolId: "script-writer" },
  { id: "2", title: "Tech review thumbnail", toolId: "thumbnail-designer" },
  { id: "3", title: "Gaming channel SEO", toolId: "seo-optimizer" },
];

const Index = () => {
  const location = useLocation();
  const initialToolId = (location.state as any)?.toolId;
  const initialTool = initialToolId ? AI_TOOLS.find((t) => t.id === initialToolId) : undefined;

  const [selectedTool, setSelectedTool] = useState<AITool | undefined>(initialTool);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNewChat = () => {
    setSelectedTool(undefined);
  };

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-background">
      <DesktopSidebar
        onNewChat={handleNewChat}
        isMainChat={!selectedTool}
        chatHistory={MOCK_HISTORY}
      />

      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        isMainChat={!selectedTool}
        chatHistory={MOCK_HISTORY}
      />

      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <div className="absolute top-2.5 right-3 z-30 sm:top-3 sm:right-4">
          <ProfileMenu />
        </div>
        <ChatWorkspace
          key={selectedTool?.id ?? "main-chat"}
          tool={selectedTool}
          onMenuClick={() => setSidebarOpen(true)}
        />
      </div>
    </div>
  );
};

export default Index;
