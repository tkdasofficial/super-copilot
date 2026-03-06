import { useState, useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/mock-data";
import { Copy, Check, FileText, List, Code, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";

type Props = { message: ChatMessageType; isNew?: boolean };

const CHARS_PER_SECOND = 60;

const ChatMessage = ({ message, isNew = false }: Props) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("px-4 py-3 max-w-2xl mx-auto animate-fade-up")}>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        {isUser ? "You" : "Super Copilot"}
      </p>
      {isUser ? (
        <div className="rounded-xl bg-primary/5 border border-border px-3.5 py-2.5">
          <p className="text-[15px] text-foreground leading-relaxed">{message.content}</p>
        </div>
      ) : message.structuredOutput ? (
        <StructuredOutput sections={message.structuredOutput.sections} animate={isNew} />
      ) : (
        <StreamingText text={message.content} animate={isNew} />
      )}
    </div>
  );
};

// Streaming text with clean paragraph rendering (no markdown symbols)
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

  const isStreaming = animate && indexRef.current < text.length;

  // Split into paragraphs and render with numbered items styled
  const paragraphs = displayed.split("\n\n");

  return (
    <div className="space-y-2.5">
      {paragraphs.map((para, i) => {
        // Check if it starts with a number like "1. " or "2. "
        const numberMatch = para.match(/^(\d+)\.\s(.+)/s);
        if (numberMatch) {
          const [, num, rest] = numberMatch;
          // Split on " - " to get title and description
          const dashIdx = rest.indexOf(" - ");
          const title = dashIdx > -1 ? rest.slice(0, dashIdx) : rest;
          const desc = dashIdx > -1 ? rest.slice(dashIdx + 3) : "";
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-card border border-border px-3 py-2.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-semibold text-primary">{num}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{title}</p>
                {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
              </div>
            </div>
          );
        }
        return (
          <p key={i} className="text-[15px] text-foreground leading-relaxed">{para}</p>
        );
      })}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-text-bottom animate-pulse" />
      )}
    </div>
  );
};

// Section type icon mapping
const sectionIcon = (type: string) => {
  switch (type) {
    case "list": return List;
    case "code": return Code;
    default: return FileText;
  }
};

// Structured output with card reveal
const StructuredOutput = ({ sections, animate }: { sections: { title: string; content: string; type: string }[]; animate: boolean }) => {
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : sections.length);

  useEffect(() => {
    if (!animate) { setVisibleCount(sections.length); return; }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= sections.length) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [sections.length, animate]);

  return (
    <div className="space-y-2.5">
      {sections.slice(0, visibleCount).map((section, i) => {
        const Icon = sectionIcon(section.type);
        return (
          <div
            key={i}
            className="rounded-xl border border-border bg-card overflow-hidden animate-fade-up"
          >
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-accent/40">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <h4 className="text-xs font-display font-semibold text-foreground">{section.title}</h4>
              </div>
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
                <div className="space-y-1.5">
                  {section.content.split("\n").map((line, j) => {
                    if (!line.trim()) return null;
                    // Lines that look like section headers (ALL CAPS or title-like)
                    const isHeader = /^[A-Z][A-Z\s\d\-()&:]+$/.test(line.trim()) || /^(HOOK|INTRO|TOOL|CTA|OUTRO)/.test(line.trim());
                    if (isHeader) {
                      return (
                        <div key={j} className="flex items-center gap-1.5 pt-1.5 first:pt-0">
                          <ChevronRight className="w-3 h-3 text-primary" />
                          <span className="text-xs font-display font-semibold text-primary">{line}</span>
                        </div>
                      );
                    }
                    return (
                      <p key={j} className="text-sm text-secondary-foreground leading-relaxed">{line}</p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
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
