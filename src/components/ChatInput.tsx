import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  toolName?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
};

const ChatInput = ({ toolName, onSend, disabled }: Props) => {
  const [value, setValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;

  const updateTextareaSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${nextHeight}px`;
    setIsExpanded(nextHeight > 52);
  };

  const handleSend = () => {
    if (!hasText || disabled) return;
    onSend(value.trim());
    setValue("");
    setIsExpanded(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = toolName ? `Ask ${toolName}...` : "Message Super Copilot...";

  return (
    <div className="w-full px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className="max-w-2xl mx-auto">
        <div
          className={cn(
            "border border-border bg-card transition-all duration-300 focus-within:border-foreground/20 overflow-hidden",
            isExpanded ? "rounded-2xl" : "rounded-[24px]",
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={updateTextareaSize}
            placeholder={placeholder}
            rows={1}
            className="w-full bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground resize-none outline-none min-h-[44px] max-h-[150px] py-3 px-4"
          />

          {/* Action row inside prompt box */}
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={hasText ? handleSend : undefined}
              disabled={hasText ? disabled : false}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                hasText
                  ? "bg-foreground text-background hover:opacity-80 disabled:opacity-50"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {hasText ? <ArrowUp className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-2 hidden sm:block">
          Super Copilot may produce inaccurate results. Verify important information.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
