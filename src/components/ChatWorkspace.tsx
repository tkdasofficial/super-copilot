import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import type { AITool, ChatMessage as ChatMessageType } from "@/lib/mock-data";
import { useChatHistory } from "@/context/ChatHistoryContext";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator from "./TypingIndicator";

type Props = {
  tool?: AITool;
  onMenuClick: () => void;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatWorkspace = ({ tool, onMenuClick }: Props) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasSavedToHistory, setHasSavedToHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addChat } = useChatHistory();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(async (content: string, imageData?: { base64: string; mimeType: string }) => {
    // Build user message
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      toolId: tool?.id,
      imageUrl: imageData ? `data:${imageData.mimeType};base64,${imageData.base64}` : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Save first message as chat history entry
    if (!hasSavedToHistory) {
      const title = content.length > 40 ? content.slice(0, 40) + "..." : content;
      addChat(title, content, tool?.id);
      setHasSavedToHistory(true);
    }

    // Check if this is an image generation request
    const isImageGen = tool?.id === "image-generator" || /\b(generate|create|make|draw|design)\b.*\b(image|picture|photo|illustration|graphic|visual|thumbnail|art)\b/i.test(content);
    const isImageToImage = imageData && isImageGen;

    if (isImageToImage) {
      // Image-to-image flow
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-to-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            image: imageData.base64,
            mimeType: imageData.mimeType,
            instruction: content,
            aspect_ratio: "1:1",
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Image generation failed");

        const imageUrl = data.images?.[0]?.base64
          ? `data:image/png;base64,${data.images[0].base64}`
          : data.images?.[0]?.url || data.images?.[0];

        const aiMsg: ChatMessageType = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Here is your generated image based on the reference. Prompt used: ${data.prompt || "optimized prompt"}`,
          timestamp: new Date(),
          toolId: tool?.id,
          imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, image generation failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      setIsTyping(false);
      return;
    }

    if (isImageGen && !imageData) {
      // Text-to-image flow
      try {
        // First get an optimized prompt from Gemini
        const chatMessages = [{ role: "user", content }];
        
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: content, aspect_ratio: "1:1", model: "flux" }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Image generation failed");

        const imageUrl = data.images?.[0]?.base64
          ? `data:image/png;base64,${data.images[0].base64}`
          : data.images?.[0]?.url || data.images?.[0];

        const aiMsg: ChatMessageType = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Here is your generated image!",
          timestamp: new Date(),
          toolId: tool?.id,
          imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, image generation failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      setIsTyping(false);
      return;
    }

    // Regular chat - streaming with Gemini
    try {
      // Build conversation history for context
      const chatMessages = messages
        .filter((m) => !m.imageUrl || m.role === "user")
        .map((m) => {
          if (m.imageUrl && m.role === "user") {
            return {
              role: "user",
              content: [
                { type: "text", text: m.content },
                { type: "image_url", image_url: { url: m.imageUrl } },
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

      // Add current message
      if (imageData) {
        chatMessages.push({
          role: "user",
          content: [
            { type: "text", text: content },
            { type: "image_url", image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
          ],
        });
      } else {
        chatMessages.push({ role: "user", content });
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: chatMessages, toolId: tool?.id }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Chat failed");
      }

      // Stream response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let assistantMsgCreated = false;
      const aiId = (Date.now() + 1).toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              if (!assistantMsgCreated) {
                assistantMsgCreated = true;
                setMessages((prev) => [...prev, {
                  id: aiId,
                  role: "assistant",
                  content: assistantContent,
                  timestamp: new Date(),
                  toolId: tool?.id,
                }]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: assistantContent } : m)
                );
              }
            }
          } catch {
            // partial JSON, skip
          }
        }
      }

      if (!assistantMsgCreated) {
        setMessages((prev) => [...prev, {
          id: aiId,
          role: "assistant",
          content: assistantContent || "I couldn't generate a response. Please try again.",
          timestamp: new Date(),
          toolId: tool?.id,
        }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, an error occurred: ${e.message}`,
        timestamp: new Date(),
      }]);
    }

    setIsTyping(false);
  }, [tool, hasSavedToHistory, addChat, messages]);

  const hasMessages = messages.length > 0;
  const title = tool ? tool.shortName : "Super Copilot";

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
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
        <div className="w-9 lg:hidden" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="py-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} isNew={false} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        ) : (
          <EmptyState tool={tool} onPromptClick={(prompt) => handleSend(prompt)} />
        )}
      </div>

      <ChatInput toolName={tool?.shortName} onSend={handleSend} disabled={isTyping} />
    </div>
  );
};

export default ChatWorkspace;
