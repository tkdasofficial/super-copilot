import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { AI_TOOLS } from "@/lib/mock-data";
import ProfileMenu from "@/components/ProfileMenu";

type ChatHistoryItem = {
  id: string;
  title: string;
  toolId: string;
  preview: string;
  date: string;
};

const MOCK_HISTORY: ChatHistoryItem[] = [
  { id: "1", title: "AI tools for creators script", toolId: "script-writer", preview: "Write a 10-minute YouTube script about AI tools...", date: "Today" },
  { id: "2", title: "Tech review thumbnail", toolId: "thumbnail-designer", preview: "Design a thumbnail for a tech review video...", date: "Today" },
  { id: "3", title: "Gaming channel SEO", toolId: "seo-optimizer", preview: "Optimize SEO for my gaming channel...", date: "Yesterday" },
  { id: "4", title: "Horror story narration", toolId: "script-writer", preview: "Create a horror story narration script with...", date: "Yesterday" },
  { id: "5", title: "Productivity hacks short", toolId: "content-optimizer", preview: "Generate a full content package for productivity...", date: "Mar 4" },
  { id: "6", title: "Blockchain explainer", toolId: "script-writer", preview: "Write an educational explainer script about...", date: "Mar 3" },
  { id: "7", title: "Fitness transformation SEO", toolId: "seo-optimizer", preview: "Create a full SEO package for a fitness...", date: "Mar 2" },
  { id: "8", title: "Fantasy story illustrations", toolId: "image-generator", preview: "Design an illustration for a fantasy story video...", date: "Mar 1" },
];

const History = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(MOCK_HISTORY);
  const [search, setSearch] = useState("");

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.preview.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, ChatHistoryItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const getToolName = (toolId: string) => {
    return AI_TOOLS.find((t) => t.id === toolId)?.shortName || "Chat";
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
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 mb-5 focus-within:border-foreground/20 transition-colors">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* Results */}
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
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 hover:bg-accent transition-colors group cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-foreground truncate">{chat.title}</p>
                          <span className="px-2 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground shrink-0">{getToolName(chat.toolId)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{chat.preview}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(chat.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
