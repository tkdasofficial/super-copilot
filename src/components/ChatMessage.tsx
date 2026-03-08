import { useState } from "react";
import type { ChatMessage as ChatMessageType, StockVideo } from "@/lib/types";
import { Copy, Check, Play, ExternalLink, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import VideoGenerationCard from "./VideoGenerationCard";
import VideoEditorCard from "./VideoEditorCard";
import WebAppPreviewCard from "./WebAppPreviewCard";

type Props = { message: ChatMessageType; isNew?: boolean };

const ChatMessage = ({ message, isNew = false }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("px-4 py-2 max-w-2xl mx-auto", isNew && "animate-fade-up")}>
      {isUser ? (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground text-background px-4 py-2.5">
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Attached"
                className="w-32 h-32 rounded-lg object-cover mb-2 border border-background/10"
              />
            )}
            <p className="text-[15px] leading-relaxed">{message.content}</p>
          </div>
        </div>
      ) : (
        <div className="max-w-[92%] space-y-2.5">
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Generated"
              className="max-w-sm w-full rounded-xl border border-border"
            />
          )}
          {message.content && (
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground [&_p]:leading-relaxed [&_p]:mb-2 [&_li]:leading-relaxed [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_strong]:text-foreground [&_a]:text-primary [&_code]:bg-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm [&_pre]:bg-accent [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:p-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-accent [&_th]:text-sm [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_hr]:border-border [&_ul]:space-y-1 [&_ol]:space-y-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
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
            <VideoEditorCard
              userMessage={message.videoEdit.userMessage}
            />
          )}
          {message.webApp && (
            <WebAppPreviewCard project={message.webApp} />
          )}
        </div>
      )}
    </div>
  );
};

const VideoGrid = ({ videos }: { videos: StockVideo[] }) => {
  const [playingId, setPlayingId] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      {videos.map((video) => (
        <div
          key={video.id}
          className="relative group rounded-xl border border-border overflow-hidden bg-card"
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
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Download HD"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="View on Pexels"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default ChatMessage;
