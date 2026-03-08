import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Mic, X, RectangleHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1", icon: "⬜" },
  { value: "4:3", label: "4:3", icon: "▬" },
  { value: "16:9", label: "16:9", icon: "━" },
  { value: "3:4", label: "3:4", icon: "▮" },
  { value: "9:16", label: "9:16", icon: "▯" },
] as const;

type Props = {
  toolName?: string;
  onSend: (message: string, imageData?: { base64: string; mimeType: string }, aspectRatio?: string) => void;
  disabled?: boolean;
  showAspectRatio?: boolean;
};

const ChatInput = ({ toolName, onSend, disabled, showAspectRatio = false }: Props) => {
  const [value, setValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [showRatioPicker, setShowRatioPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasText = value.trim().length > 0;
  const hasContent = hasText || attachedImage;

  const updateTextareaSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${nextHeight}px`;
    setIsExpanded(nextHeight > 52);
  };

  const handleSend = () => {
    if (!hasContent || disabled) return;
    onSend(
      value.trim() || (attachedImage ? "Analyze this image" : ""),
      attachedImage ? { base64: attachedImage.base64, mimeType: attachedImage.mimeType } : undefined,
      aspectRatio
    );
    setValue("");
    setAttachedImage(null);
    setIsExpanded(false);
    setShowRatioPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setAttachedImage({
        base64,
        mimeType: file.type,
        preview: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const placeholder = toolName ? `Ask ${toolName}...` : "Message Super Copilot...";

  return (
    <div className="w-full px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className="max-w-2xl mx-auto">
        <div
          className={cn(
            "border border-border bg-card transition-all duration-300 focus-within:border-foreground/20 overflow-hidden",
            isExpanded || attachedImage ? "rounded-2xl" : "rounded-[24px]",
          )}
        >
          {/* Attached image preview */}
          {attachedImage && (
            <div className="px-3 pt-3">
              <div className="relative inline-block">
                <img
                  src={attachedImage.preview}
                  alt="Attached"
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Aspect ratio picker */}
          {showRatioPicker && showAspectRatio && (
            <div className="px-3 pt-2 flex items-center gap-1.5 animate-fade-in">
              <span className="text-[11px] text-muted-foreground mr-1">Ratio:</span>
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setAspectRatio(r.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                    aspectRatio === r.value
                      ? "bg-foreground text-background"
                      : "bg-accent/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

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
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-[18px] h-[18px]" />
              </button>

              {showAspectRatio && (
                <button
                  type="button"
                  onClick={() => setShowRatioPicker(!showRatioPicker)}
                  className={cn(
                    "h-8 px-2 rounded-full flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                    showRatioPicker && "bg-accent text-foreground"
                  )}
                  title="Aspect ratio"
                >
                  <RectangleHorizontal className="w-[16px] h-[16px]" />
                  <span className="text-[11px] font-medium">{aspectRatio}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={hasContent ? handleSend : undefined}
              disabled={hasContent ? disabled : false}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                hasContent
                  ? "bg-foreground text-background hover:opacity-80 disabled:opacity-50"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {hasContent ? <ArrowUp className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
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
