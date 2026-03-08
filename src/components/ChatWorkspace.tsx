import { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import type { AITool, ChatMessage as ChatMessageType } from "@/lib/types";
import ProfileMenu from "./ProfileMenu";
import { useChatHistory } from "@/context/ChatHistoryContext";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator, { detectPhase, type ThinkingPhase } from "./TypingIndicator";
import { detectAspectRatio } from "@/lib/detect-aspect-ratio";
import { getCategory } from "@/lib/file-converter";
import { analyzeZip } from "@/lib/zip-analyzer";
import type { TaskMode } from "./TaskModeSelector";
type Props = {
  tool?: AITool;
  onMenuClick: () => void;
  initialMessages?: ChatMessageType[];
  chatId?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const CODE_GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-generator`;

const ChatWorkspace = ({ tool, onMenuClick, initialMessages, chatId: externalChatId }: Props) => {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages || []);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>("thinking");
  const [chatId, setChatId] = useState<string | null>(externalChatId || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addChat, updateChatMessages } = useChatHistory();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Persist messages to history whenever they change
  useEffect(() => {
    if (chatId && messages.length > 0) {
      updateChatMessages(chatId, messages);
    }
  }, [messages, chatId, updateChatMessages]);

  const handleSend = useCallback(async (content: string, imageData?: { base64: string; mimeType: string }, taskMode?: TaskMode) => {
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      toolId: tool?.id,
      imageUrl: imageData ? `data:${imageData.mimeType};base64,${imageData.base64}` : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Detect phase from content
    const phase = detectPhase(content, tool?.id);
    setThinkingPhase("thinking"); // Always start with thinking
    setIsTyping(true);

    // Save first message as chat history entry
    if (!chatId) {
      const title = content.length > 40 ? content.slice(0, 40) + "..." : content;
      const newId = addChat(title, content, tool?.id);
      setChatId(newId);
    }

    // Transition from "thinking" to the actual work phase after a delay
    const phaseTimer = setTimeout(() => {
      setThinkingPhase(phase);
    }, 1200);

    // Check if this is an image generation request
    const isImageGen = taskMode === "designer" || tool?.id === "image-generator" || /\b(generate|create|make|draw|design)\b.*\b(image|picture|photo|illustration|graphic|visual|thumbnail|art)\b/i.test(content);
    const detectedRatio = detectAspectRatio(content);
    const isImageToImage = imageData && isImageGen;

    if (isImageToImage) {
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
            aspect_ratio: detectedRatio,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Image generation failed");

        const firstImg = data.images?.[0];
        const imageUrl = firstImg?.base64
          ? `data:image/png;base64,${firstImg.base64}`
          : firstImg?.url || (typeof firstImg === "string" ? firstImg : undefined);

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Here is your generated image based on the reference. Prompt used: ${data.prompt || "optimized prompt"}`,
          timestamp: new Date(),
          toolId: tool?.id,
          imageUrl,
        }]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, image generation failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      clearTimeout(phaseTimer);
      setIsTyping(false);
      return;
    }

    if (isImageGen && !imageData) {
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: content, aspect_ratio: detectedRatio, model: "flux" }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Image generation failed");

        const firstImg = data.images?.[0];
        const imageUrl = firstImg?.base64
          ? `data:image/png;base64,${firstImg.base64}`
          : firstImg?.url || (typeof firstImg === "string" ? firstImg : undefined);

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Here is your generated image!",
          timestamp: new Date(),
          toolId: tool?.id,
          imageUrl,
        }]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, image generation failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      clearTimeout(phaseTimer);
      setIsTyping(false);
      return;
    }

    // Agent mode: web apps & games (2D/3D) builder detection
    const isAgent = taskMode === "agent" || /\b(build|create|make|generate)\b.*\b(web\s*app|website|landing\s*page|dashboard|portfolio|SPA|single.page.app|game|2d|3d|platformer|rpg|puzzle|arcade|shooter)\b/i.test(content);

    if (isAgent) {
      try {
        // Gather existing project state from previous messages
        const lastWebApp = [...messages].reverse().find((m) => m.webApp)?.webApp;

        // Build conversation history for context continuity
        const conversationHistory = messages
          .filter((m) => !m.imageUrl && !m.videos && !m.videoGeneration && !m.videoEdit)
          .map((m) => ({ role: m.role, content: m.content }));

        // Detect quality mode from content
        const quality = /\b(production|prod|professional|polished)\b/i.test(content)
          ? "production"
          : /\b(prototype|proto|quick|simple|fast|basic)\b/i.test(content)
          ? "prototype"
          : "production"; // default to production for 10x quality

        const resp = await fetch(CODE_GEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content }],
            projectState: lastWebApp || undefined,
            conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
            quality,
          }),
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Code generation failed");

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.explanation || "Here's your generated web application!",
          timestamp: new Date(),
          webApp: {
            files: data.files,
            framework: data.framework,
            dependencies: data.dependencies || {},
            entryPoint: data.entryPoint || "index.html",
            explanation: data.explanation || "",
            quality,
          },
        }]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, code generation failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      clearTimeout(phaseTimer);
      setIsTyping(false);
      return;
    }

    // AI Video editing / generation detection
    const isVideoEdit = /\b(edit|cut|trim|crop|add\s*(text|music|filter|transition|overlay|effect)|change\s*(speed|timing|pacing)|slow\s*mo|speed\s*up|reorder|split|delete\s*scene|regenerate|re-?render|improve\s*video|enhance\s*video|make\s*(it|the\s*video)\s*(better|shorter|longer|faster|slower)|analyz|check\s*quality|visual\s*consistency|quality\s*check)\b/i.test(content);
    const isVideoCreation = /\b(create|make|generate|produce)\b.*\b(video|short|reel|tiktok|clip|documentary|youtube|essay|explainer)\b.*\b(about|on|for|of)\b/i.test(content)
      || /\b(short[\s-]*form|short|long[\s-]*form|long)\b.*\b(video|content)\b/i.test(content)
      || /\b(create|make|generate)\b.*\b(video)\b/i.test(content);

    if (isVideoCreation || isVideoEdit) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: isVideoCreation
          ? `Processing your video request...`
          : `Applying your edits...`,
        timestamp: new Date(),
        videoEdit: {
          userMessage: content,
          isNewProject: isVideoCreation,
        },
      }]);

      clearTimeout(phaseTimer);
      setIsTyping(false);
      return;
    }

    // Stock footage search for video mode
    const isVideoSearch = taskMode === "video" || /\b(stock\s*(footage|video|clip)|b[\s-]*roll|video\s*clip)\b/i.test(content);
    if (isVideoSearch) {
      try {
        // Extract search query - use Gemini to parse intent or fall back to content
        const searchQuery = content.replace(/\b(find|search|get|show|stock|footage|video|clip|b[\s-]*roll)\b/gi, "").trim() || content;

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pexels-videos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ query: searchQuery, per_page: 6 }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Stock footage search failed");

        const videos = data.videos || [];
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: videos.length > 0
            ? `Found ${data.total_results} stock videos for "${searchQuery}". Here are the top results:`
            : `No stock footage found for "${searchQuery}". Try a different search term.`,
          timestamp: new Date(),
          videos: videos.length > 0 ? videos : undefined,
        }]);
      } catch (e: any) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, stock footage search failed: ${e.message}`,
          timestamp: new Date(),
        }]);
      }
      clearTimeout(phaseTimer);
      setIsTyping(false);
      return;
    }

    // Regular chat - streaming
    try {
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

      // Switch to working phase once streaming starts
      setThinkingPhase(phase === "thinking" ? "working" : phase);

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
              // Once we get first token, stop showing typing indicator
              if (!assistantMsgCreated) {
                setIsTyping(false);
              }
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

    clearTimeout(phaseTimer);
    setIsTyping(false);
  }, [tool, chatId, addChat, messages, updateChatMessages]);

  const handleZipUpload = useCallback(async (file: File) => {
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content: `Uploaded ZIP file: ${file.name}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setThinkingPhase("thinking");

    if (!chatId) {
      const title = `ZIP: ${file.name}`;
      const newId = addChat(title, `Uploaded ${file.name}`, tool?.id);
      setChatId(newId);
    }

    try {
      const analysis = await analyzeZip(file);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Analyzed **${analysis.fileName}** — ${analysis.totalFiles} files in ${analysis.totalDirectories} folders (${formatBytes(analysis.totalSize)} total, ${analysis.compressionRatio}% compression). Top file types: ${Object.entries(analysis.fileTypes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ext, n]) => `.${ext} (${n})`).join(", ")}.`,
        timestamp: new Date(),
        zipAnalysis: analysis,
      }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Failed to extract ZIP file: ${e.message}`,
        timestamp: new Date(),
      }]);
    }
    setIsTyping(false);
  }, [chatId, addChat, tool]);

  const handleFileConvert = useCallback((file: File) => {
    const cat = getCategory(file);
    if (!cat) return;

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content: `Convert file: ${file.name}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (!chatId) {
      const title = `Convert: ${file.name}`;
      const newId = addChat(title, `Convert ${file.name}`, tool?.id);
      setChatId(newId);
    }

    setMessages((prev) => [...prev, {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Here's the file converter for **${file.name}**. Select your target format and click convert:`,
      timestamp: new Date(),
      convertFile: file,
    }]);
  }, [chatId, addChat, tool]);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

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
        <ProfileMenu />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="py-3">
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id} message={msg} isNew={i === messages.length - 1 && msg.role === "assistant"} />
            ))}
            {isTyping && <TypingIndicator phase={thinkingPhase} />}
          </div>
        ) : (
          <EmptyState tool={tool} onPromptClick={(prompt) => handleSend(prompt)} />
        )}
      </div>

      <ChatInput toolName={tool?.shortName} onSend={handleSend} onZipUpload={handleZipUpload} disabled={isTyping} />
    </div>
  );
};

export default ChatWorkspace;
