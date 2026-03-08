import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/mock-data";
import { Copy, Check, FileText, List, Code, ChevronRight } from "lucide-react";
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
      ) : message.structuredOutput ? (
        <StructuredOutput sections={message.structuredOutput.sections} />
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

// Section type icon mapping
const sectionIcon = (type: string) => {
  switch (type) {
    case "list": return List;
    case "code": return Code;
    default: return FileText;
  }
};

// Structured output with card reveal
const StructuredOutput = ({ sections }: { sections: { title: string; content: string; type: string }[] }) => {
  return (
    <div className="space-y-2.5">
      {sections.map((section, i) => {
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
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default ChatMessage;
