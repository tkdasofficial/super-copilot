import { useState, useEffect, useRef, useCallback } from "react";
import {
  Code,
  Eye,
  Download,
  Copy,
  Check,
  ChevronRight,
  FileCode,
  Loader2,
  ExternalLink,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPreviewHTML, type WebAppProject, type GeneratedFile } from "@/lib/web-preview-engine";
import { downloadProjectAsZip } from "@/lib/zip-export";
import { toast } from "sonner";

type Phase = "generating" | "building" | "ready" | "error";

type Props = {
  project: WebAppProject;
};

const WebAppPreviewCard = ({ project }: Props) => {
  const [phase, setPhase] = useState<Phase>("building");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [selectedFile, setSelectedFile] = useState<string>(
    project.files[0]?.path || ""
  );
  const [previewHTML, setPreviewHTML] = useState<string>("");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    try {
      const html = buildPreviewHTML(
        project.files,
        project.framework,
        project.dependencies
      );
      setPreviewHTML(html);
      setPhase("ready");
    } catch (err) {
      console.error("Preview build failed:", err);
      setPhase("error");
    }
  }, [project]);

  const handleDownload = useCallback(async () => {
    try {
      await downloadProjectAsZip(
        project.files,
        project.framework,
        project.dependencies,
        "web-app"
      );
      toast.success("Project downloaded!");
    } catch {
      toast.error("Failed to download project");
    }
  }, [project]);

  const handleCopyFile = useCallback(
    (filePath: string) => {
      const file = project.files.find((f) => f.path === filePath);
      if (file) {
        navigator.clipboard.writeText(file.content);
        setCopiedFile(filePath);
        setTimeout(() => setCopiedFile(null), 2000);
      }
    },
    [project.files]
  );

  const handleOpenNewTab = useCallback(() => {
    const blob = new Blob([previewHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [previewHTML]);

  const currentFile = project.files.find((f) => f.path === selectedFile);

  // Group files by directory
  const fileTree = buildFileTree(project.files);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Web App Builder
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
            {project.framework}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {phase === "ready" && (
            <>
              <button
                onClick={handleOpenNewTab}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Download ZIP"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "preview"
              ? "text-foreground border-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "code"
              ? "text-foreground border-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          <Code className="w-3.5 h-3.5" />
          Code
          <span className="text-[10px] text-muted-foreground">
            ({project.files.length})
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === "preview" ? (
        <div className="relative bg-background">
          {phase === "building" && (
            <div className="flex items-center justify-center h-64 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Building preview...
              </span>
            </div>
          )}
          {phase === "error" && (
            <div className="flex items-center justify-center h-64">
              <span className="text-sm text-destructive">
                Preview build failed. Check the code tab.
              </span>
            </div>
          )}
          {phase === "ready" && (
            <iframe
              ref={iframeRef}
              srcDoc={previewHTML}
              sandbox="allow-scripts"
              className="w-full h-[400px] border-0"
              title="Web App Preview"
            />
          )}
        </div>
      ) : (
        <div className="flex h-[400px]">
          {/* File tree sidebar */}
          <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-muted/20">
            <div className="py-1">
              {fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  selectedFile={selectedFile}
                  onSelect={setSelectedFile}
                  depth={0}
                />
              ))}
            </div>
          </div>

          {/* Code viewer */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            {currentFile && (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
                  <span className="text-[11px] text-muted-foreground font-mono truncate">
                    {currentFile.path}
                  </span>
                  <button
                    onClick={() => handleCopyFile(currentFile.path)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedFile === currentFile.path ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono leading-relaxed text-foreground bg-background">
                  <code>{currentFile.content}</code>
                </pre>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer info */}
      {project.files.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground">
            {project.files.length} file{project.files.length !== 1 ? "s" : ""} ·{" "}
            {Object.keys(project.dependencies).length} dependenc
            {Object.keys(project.dependencies).length !== 1 ? "ies" : "y"}
          </p>
        </div>
      )}
    </div>
  );
};

// File tree types and component
type FileTreeNodeData = {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNodeData[];
};

function buildFileTree(files: GeneratedFile[]): FileTreeNodeData[] {
  const root: FileTreeNodeData[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: fullPath,
          isDir: !isLast,
          children: [],
        };
        current.push(existing);
      }
      if (!isLast) {
        current = existing.children;
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileTreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);

  return root;
}

function FileTreeNode({
  node,
  selectedFile,
  onSelect,
  depth,
}: {
  node: FileTreeNodeData;
  selectedFile: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.path === selectedFile;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 shrink-0 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "w-full flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors",
        isSelected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileCode className="w-3 h-3 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default WebAppPreviewCard;
