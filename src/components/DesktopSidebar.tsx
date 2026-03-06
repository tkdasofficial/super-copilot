import { cn } from "@/lib/utils";
import { PenSquare, Search, MessageSquare, Grid3X3, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.svg";

type Props = {
  onNewChat: () => void;
  isMainChat: boolean;
  chatHistory: { id: string; title: string; toolId: string }[];
};

const DesktopSidebar = ({ onNewChat, isMainChat, chatHistory }: Props) => {
  const navigate = useNavigate();

  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-sidebar border-r border-sidebar-border h-full shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={logo} alt="Super Copilot" className="w-8 h-8 rounded-full object-cover" />
        <span className="font-display font-semibold text-foreground text-sm">Super Copilot</span>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          <span>New chat</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>
      </div>

      <div className="px-3 pt-2 space-y-0.5">
        <button
          onClick={onNewChat}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            isMainChat
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => navigate("/apps")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Grid3X3 className="w-4 h-4" />
          <span>Explore Apps</span>
        </button>

        <button
          onClick={() => navigate("/history")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span>History</span>
        </button>
      </div>

      {chatHistory.length > 0 && (
        <div className="px-3 pt-4 flex-1 overflow-y-auto">
          <p className="px-3 pb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Recent</p>
          <nav className="space-y-0.5">
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors truncate"
              >
                {chat.title}
              </button>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
};

export default DesktopSidebar;
