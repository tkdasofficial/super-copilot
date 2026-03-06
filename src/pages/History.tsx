import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2, MessageSquare, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { AI_TOOLS } from "@/lib/mock-data";
import { useChatHistory } from "@/context/ChatHistoryContext";
import ProfileMenu from "@/components/ProfileMenu";

const History = () => {
  const navigate = useNavigate();
  const { history, renameChat, deleteChat, searchHistory } = useChatHistory();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = search ? searchHistory(search) : history;

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const getToolName = (toolId?: string) => {
    if (!toolId) return "Chat";
    return AI_TOOLS.find((t) => t.id === toolId)?.shortName || "Chat";
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      renameChat(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Chat History</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-4 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 mb-5 focus-within:border-foreground/20 transition-colors">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations found</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, chats]) => (
              <div key={date} className="mb-5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-1">{date}</p>
                <div className="space-y-1.5">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 hover:bg-accent transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        {editingId === chat.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setEditingId(null); }}
                              className="flex-1 px-2 py-1 rounded-lg text-sm bg-background text-foreground outline-none border border-primary/40"
                            />
                            <button onClick={confirmRename} className="p-1.5 rounded-lg text-primary hover:bg-primary/10">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-foreground truncate">{chat.title}</p>
                              <span className="px-2 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground shrink-0">{getToolName(chat.toolId)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{chat.preview}</p>
                          </>
                        )}
                      </div>
                      {editingId !== chat.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(chat.id, chat.title); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
