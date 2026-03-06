import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState, useCallback } from "react";
import { AI_TOOLS, MOCK_RESPONSE, type ChatMessage as ChatMessageType } from "@/lib/mock-data";
import ChatInput from "@/components/ChatInput";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import ProfileMenu from "@/components/ProfileMenu";
import logo from "@/assets/logo.svg";

const ToolPage = () => {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const tool = AI_TOOLS.find((t) => t.id === toolId);

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null);

  const handleSend = useCallback((content: string) => {
    if (!tool) return;
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      toolId: tool.id,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const aiId = (Date.now() + 1).toString();
      const aiMsg: ChatMessageType = {
        id: aiId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        toolId: tool.id,
        structuredOutput: MOCK_RESPONSE,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLatestMsgId(aiId);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  }, [tool]);

  if (!tool) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tool not found</p>
      </div>
    );
  }

  const Icon = tool.icon;
  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-foreground" />
          <h1 className="text-sm font-display font-semibold text-foreground">{tool.shortName}</h1>
        </div>
        <ProfileMenu />
      </header>

      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="py-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} isNew={msg.id === latestMsgId} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        ) : (
          /* Tool-specific empty state */
          <div className="flex flex-col items-center justify-center h-full px-5 animate-fade-up">
            <div className="w-16 h-16 rounded-full overflow-hidden mb-4 animate-spin-slow">
              <img src={logo} alt="Super Copilot" className="w-full h-full object-cover" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
              <Icon className="w-6 h-6 text-foreground" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground text-center mb-1.5">
              {tool.emptyStateTitle}
            </h2>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-8">
              {tool.emptyStateSubtitle}
            </p>

            <div className="w-full max-w-md grid grid-cols-2 gap-2">
              {tool.samplePrompts.map((sp, i) => {
                const SpIcon = sp.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(sp.prompt)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
                  >
                    <SpIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground leading-tight">{sp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ChatInput toolName={tool.shortName} onSend={handleSend} disabled={isTyping} />
    </div>
  );
};

export default ToolPage;
