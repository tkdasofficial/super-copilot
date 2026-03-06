import { cn } from "@/lib/utils";
import { X, PenSquare, MessageSquare, Grid3X3, Clock, Pencil, Trash2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useChatHistory } from "@/context/ChatHistoryContext";
import logo from "@/assets/logo.svg";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  isMainChat: boolean;
  chatHistory: { id: string; title: string; toolId?: string }[];
};

const MobileSidebar = ({ open, onClose, onNewChat, isMainChat, chatHistory }: Props) => {
  const navigate = useNavigate();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Super Copilot" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-display font-semibold text-foreground text-sm">Super Copilot</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-2 space-y-1.5">
          <button
            onClick={() => { onNewChat(); onClose(); }}
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

        <div className="px-3 pt-1 space-y-0.5">
          <button
            onClick={() => { onNewChat(); onClose(); }}
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
            onClick={() => { navigate("/apps"); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Explore Apps</span>
          </button>

          <button
            onClick={() => { navigate("/history"); onClose(); }}
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors truncate text-left"
                >
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </>
  );
};

export default MobileSidebar;
