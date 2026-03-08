import { useState, useCallback, useRef } from "react";
import { FileText, Download, Copy, Check, Eye, EyeOff, FileCode, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  file: {
    fileName: string;
    content: string;
    mimeType: string;
    format: string;
  };
};

const FORMAT_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  txt: FileText,
  md: FileText,
  html: FileCode,
  csv: FileSpreadsheet,
  json: FileCode,
  xml: FileCode,
  js: FileCode,
  ts: FileCode,
  py: FileCode,
  css: FileCode,
};

const FileCreatorCard = ({ file }: Props) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const Icon = FORMAT_ICONS[file.format] || FileText;
  const lines = file.content.split("\n");
  const previewLines = lines.slice(0, 20);
  const hasMore = lines.length > 20;

  const handleDownload = useCallback(() => {
    // For PDF, generate via jspdf
    if (file.format === "pdf") {
      import("jspdf").then(({ jsPDF }) => {
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const margin = 15;
        const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
        pdf.setFont("helvetica");
        pdf.setFontSize(11);
        const splitLines = pdf.splitTextToSize(file.content, maxWidth);
        let y = margin;
        const lineHeight = 5.5;
        for (const line of splitLines) {
          if (y + lineHeight > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin, y);
          y += lineHeight;
        }
        pdf.save(file.fileName);
      });
      return;
    }

    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [file]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [file.content]);

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-primary" />
          Generated File
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* File info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/30">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono font-bold text-primary uppercase">.{file.format}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {lines.length} lines • {(new Blob([file.content]).size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {/* Content preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? "Hide" : "Show"} Preview
            </button>
            <span className="text-[10px] text-muted-foreground font-mono">{file.format.toUpperCase()}</span>
          </div>

          {showPreview && (
            <div className="rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
              <pre className="p-3 text-xs font-mono text-foreground/80 overflow-x-auto max-h-[240px] overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
                {previewLines.join("\n")}
                {hasMore && (
                  <span className="text-muted-foreground">{"\n"}... {lines.length - 20} more lines</span>
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleDownload} className="flex-1 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Download {file.format.toUpperCase()}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileCreatorCard;
