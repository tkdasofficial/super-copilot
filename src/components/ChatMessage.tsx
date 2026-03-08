import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType, StockVideo } from "@/lib/types";
import { Copy, Check, Play, ExternalLink, Download, Volume2, VolumeX, ThumbsUp, ThumbsDown, Flag, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import VideoGenerationCard from "./VideoGenerationCard";
import VideoEditorCard from "./VideoEditorCard";
import WebAppPreviewCard from "./WebAppPreviewCard";

type Props = { message: ChatMessageType; isNew?: boolean };

const getMessageSize = (content: string) => {
  if (content.length < 60) return "short";
  if (content.length < 200) return "medium";
  return "long";
};

const CHARS_PER_SECOND = 100;

const useTypewriter = (text: string, enabled: boolean) => {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const chars = Math.min(Math.floor(elapsed * CHARS_PER_SECOND), text.length);
      setDisplayed(text.slice(0, chars));
      if (chars < text.length) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, enabled]);

  return { displayed, done };
};

const ChatMessage = ({ message, isNew = false }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [reported, setReported] = useState(false);
  const { toast } = useToast();

  const shouldAnimate = isNew && !isUser;
  const { displayed: displayedContent, done: typingDone } = useTypewriter(message.content, shouldAnimate);
  const size = getMessageSize(displayedContent);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      toast({ title: "Not supported", description: "Text-to-speech is not supported in this browser.", variant: "destructive" });
      return;
    }
    // Strip markdown for cleaner speech
    const plainText = message.content
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>\-|]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, ". ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [speaking, message.content, toast]);

  const handleFeedback = (type: "up" | "down") => {
    setFeedback(prev => prev === type ? null : type);
    toast({
      title: type === "up" ? "Thanks for the feedback!" : "We'll improve",
      description: type === "up" ? "Glad this was helpful." : "Sorry about that. We'll work on it.",
    });
  };

  const handleReport = () => {
    setReported(true);
    toast({ title: "Reported", description: "This response has been flagged for review." });
  };

  return (
    <div
      className={cn(
        "px-3 sm:px-4 max-w-2xl mx-auto transition-all duration-300",
        isUser ? "py-1.5" : "py-3",
        isNew && "animate-fade-in"
      )}
    >
      {isUser ? (
        <div className="flex justify-end">
          <div
            className={cn(
              "relative rounded-2xl rounded-br-sm bg-muted text-foreground transition-all duration-200",
              size === "short" && "px-4 py-2 text-[15px] max-w-[75%]",
              size === "medium" && "px-4 py-2.5 text-[15px] max-w-[82%]",
              size === "long" && "px-4 py-3 text-[14px] max-w-[88%] leading-relaxed",
            )}
          >
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Attached"
                className="w-36 h-36 rounded-xl object-cover mb-2.5 border border-background/10"
              />
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ) : (
        <div className="group relative max-w-[92%]">
          <div className="space-y-2.5">
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Generated"
                className="max-w-sm w-full rounded-xl border border-border shadow-sm"
              />
            )}

            {message.content && (
              <div
                className={cn(
                  "relative rounded-2xl rounded-tl-sm",
                  size === "short"
                    ? "bg-card border border-border px-4 py-2.5 inline-block"
                    : "px-0.5"
                )}
              >
                <div
                  className={cn(
                    "prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground",
                    "[&_p]:leading-[1.7] [&_p]:mb-2.5",
                    "[&_li]:leading-[1.7]",
                    "[&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2",
                    "[&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2",
                    "[&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
                    "[&_strong]:text-foreground [&_strong]:font-semibold",
                    "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary",
                    "[&_code]:bg-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[13px] [&_code]:font-mono",
                    "[&_pre]:bg-accent [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-3",
                    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px]",
                    "[&_blockquote]:border-l-[3px] [&_blockquote]:border-foreground/15 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3 [&_blockquote]:bg-accent/50 [&_blockquote]:rounded-r-lg [&_blockquote]:pr-3",
                    "[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border",
                    "[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-accent [&_th]:text-xs [&_th]:font-semibold [&_th]:text-left [&_th]:uppercase [&_th]:tracking-wider",
                    "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm",
                    "[&_tr:hover]:bg-accent/30",
                    "[&_ul]:space-y-1.5 [&_ul]:my-2 [&_ul]:pl-1",
                    "[&_ol]:space-y-1.5 [&_ol]:my-2 [&_ol]:pl-1",
                    "[&_li]:pl-1",
                    "[&_hr]:border-border [&_hr]:my-4",
                  )}
                >
                  <ReactMarkdown>{displayedContent}</ReactMarkdown>
                  {!typingDone && <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />}
                </div>
              </div>
            )}

            {message.videos && message.videos.length > 0 && (
              <VideoGrid videos={message.videos} />
            )}
            {message.videoGeneration && (
              <VideoGenerationCard
                topic={message.videoGeneration.topic}
                duration={message.videoGeneration.duration}
                aspectRatio={message.videoGeneration.aspectRatio}
              />
            )}
            {message.videoEdit && (
              <VideoEditorCard userMessage={message.videoEdit.userMessage} />
            )}
            {message.webApp && (
              <WebAppPreviewCard project={message.webApp} />
            )}

            {/* ChatGPT-style action bar */}
            {message.content && (
              <div className="flex items-center gap-0.5 pt-1">
                {/* TTS */}
                <ActionButton
                  onClick={handleSpeak}
                  active={speaking}
                  title={speaking ? "Stop listening" : "Listen"}
                >
                  {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </ActionButton>

                {/* Copy */}
                <ActionButton onClick={handleCopy} active={copied} title="Copy">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </ActionButton>

                {/* Thumbs up */}
                <ActionButton
                  onClick={() => handleFeedback("up")}
                  active={feedback === "up"}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </ActionButton>

                {/* Thumbs down */}
                <ActionButton
                  onClick={() => handleFeedback("down")}
                  active={feedback === "down"}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </ActionButton>

                {/* Report */}
                <ActionButton
                  onClick={handleReport}
                  active={reported}
                  disabled={reported}
                  title="Report"
                >
                  <Flag className="w-3.5 h-3.5" />
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Reusable small icon button for action bar */
const ActionButton = ({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-1.5 rounded-lg transition-colors",
      active
        ? "text-foreground bg-accent"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {children}
  </button>
);

const VideoGrid = ({ videos }: { videos: StockVideo[] }) => {
  const [playingId, setPlayingId] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      {videos.map((video) => (
        <div
          key={video.id}
          className="relative group/vid rounded-xl border border-border overflow-hidden bg-card"
        >
          {playingId === video.id ? (
            <video
              src={video.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full aspect-video object-cover"
              onClick={() => setPlayingId(null)}
            />
          ) : (
            <div
              className="relative cursor-pointer"
              onClick={() => setPlayingId(video.id)}
            >
              <img
                src={video.image}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-background/90 flex items-center justify-center">
                  <Play className="w-4 h-4 text-foreground ml-0.5" />
                </div>
              </div>
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          <div className="px-2.5 py-2 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground truncate flex-1">
              by {video.user.name}
            </p>
            <div className="flex items-center gap-1">
              <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Download HD">
                <Download className="w-3.5 h-3.5" />
              </a>
              <a href={video.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="View on Pexels">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatMessage;
