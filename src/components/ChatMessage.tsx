import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Props = { message: ChatMessageType; isNew?: boolean };

const ChatMessage = ({ message, isNew = false }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("px-4 py-3 max-w-2xl mx-auto animate-fade-up")}>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        {isUser ? "You" : "Super Copilot"}
      </p>
      {isUser ? (
        <div className="rounded-xl bg-primary/5 border border-border px-3.5 py-2.5">
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Attached"
              className="w-32 h-32 rounded-lg object-cover mb-2 border border-border"
            />
          )}
          <p className="text-[15px] text-foreground leading-relaxed">{message.content}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Generated"
              className="max-w-sm w-full rounded-xl border border-border"
            />
          )}
          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground [&_p]:leading-relaxed [&_p]:mb-2 [&_li]:leading-relaxed [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_strong]:text-foreground [&_a]:text-primary">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      )}
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
