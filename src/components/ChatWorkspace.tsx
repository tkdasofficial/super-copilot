import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import type { AITool, ChatMessage as ChatMessageType } from "@/lib/mock-data";
import { MOCK_RESPONSE, MOCK_TEXT_RESPONSE } from "@/lib/mock-data";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator from "./TypingIndicator";

type Props = {
  tool?: AITool;
  onMenuClick: () => void;
};

const ChatWorkspace = ({ tool, onMenuClick }: Props) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback((content: string) => {
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      toolId: tool?.id,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const delay = 1500 + Math.random() * 1000;
    setTimeout(() => {
      const aiId = (Date.now() + 1).toString();
      const isToolChat = !!tool;
      const aiMsg: ChatMessageType = {
        id: aiId,
        role: "assistant",
        content: isToolChat ? "" : MOCK_TEXT_RESPONSE,
        timestamp: new Date(),
        toolId: tool?.id,
        structuredOutput: isToolChat ? MOCK_RESPONSE : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLatestMsgId(aiId);
      setIsTyping(false);
    }, delay);
  }, [tool]);

  const hasMessages = messages.length > 0;
  const title = tool ? tool.shortName : "Super Copilot";

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {tool && <tool.icon className="w-4 h-4 text-foreground" />}
          <h2 className="text-sm font-display font-semibold text-foreground">{title}</h2>
        </div>

        {/* Spacer for profile icon (handled by parent) */}
        <div className="w-9 lg:hidden" />
      </header>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="py-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} isNew={msg.id === latestMsgId} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        ) : (
          <EmptyState tool={tool} onPromptClick={handleSend} />
        )}
      </div>

      {/* Input */}
      <ChatInput toolName={tool?.shortName} onSend={handleSend} disabled={isTyping} />
    </div>
  );
};

export default ChatWorkspace;
