import { useState, useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/mock-data";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";

type Props = { message: ChatMessageType; isNew?: boolean };

const CHARS_PER_SECOND = 50;

const ChatMessage = ({ message, isNew = false }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3 max-w-2xl mx-auto animate-fade-up")}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
            <span className="text-xs font-medium text-foreground">U</span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full overflow-hidden">
            <img src={logo} alt="AI" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {isUser ? "You" : "Super Copilot"}
        </p>
        {isUser ? (
          <p className="text-[15px] text-foreground">{message.content}</p>
        ) : message.structuredOutput ? (
          <StructuredOutput sections={message.structuredOutput.sections} animate={isNew} />
        ) : (
          <StreamingText text={message.content} animate={isNew} />
        )}
      </div>
    </div>
  );
};

// Streaming text effect at 50 chars/sec
const StreamingText = ({ text, animate }: { text: string; animate: boolean }) => {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!animate) { setDisplayed(text); return; }
    indexRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) clearInterval(interval);
    }, 1000 / CHARS_PER_SECOND);
    return () => clearInterval(interval);
  }, [text, animate]);

  return <p className="text-[15px] text-foreground whitespace-pre-wrap">{displayed}<span className={cn("inline-block w-0.5 h-4 bg-foreground ml-0.5 align-text-bottom", indexRef.current >= text.length && !animate ? "hidden" : "animate-pulse")} /></p>;
};

// Structured output with fast card reveal
const StructuredOutput = ({ sections, animate }: { sections: { title: string; content: string; type: string }[]; animate: boolean }) => {
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : sections.length);

  useEffect(() => {
    if (!animate) { setVisibleCount(sections.length); return; }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= sections.length) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [sections.length, animate]);

  return (
    <div className="space-y-2.5">
      {sections.slice(0, visibleCount).map((section, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card overflow-hidden animate-fade-up"
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-accent/30">
            <h4 className="text-xs font-display font-semibold text-foreground">{section.title}</h4>
            <CopyButton text={section.content} />
          </div>
          <div className="px-3.5 py-2.5">
            {section.type === "list" ? (
              <div className="flex flex-wrap gap-1.5">
                {section.content.split(", ").map((tag, j) => (
                  <span key={j} className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-secondary-foreground whitespace-pre-wrap leading-relaxed">{section.content}</p>
            )}
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
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default ChatMessage;
