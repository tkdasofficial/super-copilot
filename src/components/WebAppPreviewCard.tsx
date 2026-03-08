import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Monitor,
  Tablet,
  Smartphone,
  Terminal,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPreviewHTML, type WebAppProject, type GeneratedFile } from "@/lib/web-preview-engine";
import { downloadProjectAsZip } from "@/lib/zip-export";
import { toast } from "sonner";

type Phase = "generating" | "building" | "ready" | "error";
type Viewport = "desktop" | "tablet" | "mobile";
type ConsoleEntry = { level: "log" | "warn" | "error"; message: string; ts: number };

const VIEWPORT_SIZES: Record<Viewport, number> = {
  desktop: 0, // full width
  tablet: 768,
  mobile: 375,
};

type Props = {
  project: WebAppProject;
};

const WebAppPreviewCard = ({ project }: Props) => {
  const [phase, setPhase] = useState<Phase>("building");
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "console">("preview");
  const [selectedFile, setSelectedFile] = useState<string>(project.files[0]?.path || "");
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [previewHTML, setPreviewHTML] = useState<string>("");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Merge edited files with project files
  const currentFiles = useMemo(() => {
    return project.files.map((f) => ({
      ...f,
      content: editedFiles[f.path] ?? f.content,
    }));
  }, [project.files, editedFiles]);

  // Build preview whenever files change
  const rebuildPreview = useCallback(() => {
    try {
      const html = buildPreviewHTML(currentFiles, project.framework, project.dependencies);
      setPreviewHTML(html);
      setPhase("ready");
    } catch (err) {
      console.error("Preview build failed:", err);
      setPhase("error");
    }
  }, [currentFiles, project.framework, project.dependencies]);

  useEffect(() => {
    rebuildPreview();
  }, [rebuildPreview]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "console") {
        setConsoleLogs((prev) => [
          ...prev.slice(-99), // keep last 100
          { level: e.data.level, message: e.data.message, ts: Date.now() },
        ]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      await downloadProjectAsZip(currentFiles, project.framework, project.dependencies, "web-app");
      toast.success("Project downloaded!");
    } catch {
      toast.error("Failed to download project");
    }
  }, [currentFiles, project.framework, project.dependencies]);

  const handleCopyFile = useCallback(
    (filePath: string) => {
      const file = currentFiles.find((f) => f.path === filePath);
      if (file) {
        navigator.clipboard.writeText(file.content);
        setCopiedFile(filePath);
        setTimeout(() => setCopiedFile(null), 2000);
      }
    },
    [currentFiles]
  );

  const handleOpenNewTab = useCallback(() => {
    const blob = new Blob([previewHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [previewHTML]);

  const handleFileEdit = useCallback((path: string, content: string) => {
    setEditedFiles((prev) => ({ ...prev, [path]: content }));
  }, []);

  const handleResetFile = useCallback((path: string) => {
    setEditedFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const hasEdits = Object.keys(editedFiles).length > 0;
  const currentFile = currentFiles.find((f) => f.path === selectedFile);
  const fileTree = useMemo(() => buildFileTree(currentFiles), [currentFiles]);
  const errorCount = consoleLogs.filter((l) => l.level === "error").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Web App Builder</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
            {project.framework}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {phase === "ready" && (
            <>
              {/* Viewport toggles */}
              {[
                { id: "desktop" as Viewport, icon: Monitor },
                { id: "tablet" as Viewport, icon: Tablet },
                { id: "mobile" as Viewport, icon: Smartphone },
              ].map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setViewport(id)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewport === id
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  title={id}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1" />
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
        {([
          { id: "preview" as const, label: "Preview", icon: Eye },
          { id: "code" as const, label: "Code", icon: Code, badge: currentFiles.length },
          { id: "console" as const, label: "Console", icon: Terminal, badge: errorCount || undefined },
        ]).map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-b-2",
              activeTab === id
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge !== undefined && (
              <span className={cn(
                "text-[10px] px-1 rounded-full min-w-[16px] text-center",
                id === "console" && errorCount > 0
                  ? "bg-destructive/20 text-destructive"
                  : "text-muted-foreground"
              )}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "preview" ? (
        <div className="relative bg-background flex justify-center">
          {phase === "building" && (
            <div className="flex items-center justify-center h-80 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Building preview...</span>
            </div>
          )}
          {phase === "error" && (
            <div className="flex items-center justify-center h-80">
              <span className="text-sm text-destructive">Preview build failed. Check the code tab.</span>
            </div>
          )}
          {phase === "ready" && (
            <div
              className="w-full transition-all duration-300"
              style={{
                maxWidth: VIEWPORT_SIZES[viewport] || "100%",
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={previewHTML}
                sandbox="allow-scripts"
                className="w-full h-[450px] border-0"
                title="Web App Preview"
                key={previewHTML.length} // force remount on rebuild
              />
            </div>
          )}
        </div>
      ) : activeTab === "code" ? (
        <div className="flex h-[450px]">
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
                  editedPaths={editedFiles}
                />
              ))}
            </div>
          </div>

          {/* Code editor / viewer */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            {currentFile && (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
                  <span className="text-[11px] text-muted-foreground font-mono truncate">
                    {currentFile.path}
                    {editedFiles[currentFile.path] !== undefined && (
                      <span className="ml-1 text-primary">●</span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {editedFiles[currentFile.path] !== undefined && (
                      <button
                        onClick={() => handleResetFile(currentFile.path)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Reset to original"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isEditing
                          ? "text-foreground bg-accent"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={isEditing ? "View mode" : "Edit mode"}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
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
                </div>
                {isEditing ? (
                  <textarea
                    value={currentFile.content}
                    onChange={(e) => handleFileEdit(currentFile.path, e.target.value)}
                    className="flex-1 w-full p-3 text-[11px] font-mono leading-relaxed text-foreground bg-background resize-none outline-none border-0"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono leading-relaxed text-foreground bg-background">
                    <code>{currentFile.content}</code>
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Console tab */
        <div className="h-[450px] overflow-y-auto bg-background p-2">
          {consoleLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No console output yet. Interact with the preview to see logs.
            </div>
          ) : (
            <div className="space-y-0.5">
              {consoleLogs.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-mono",
                    entry.level === "error" && "bg-destructive/10 text-destructive",
                    entry.level === "warn" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                    entry.level === "log" && "text-muted-foreground"
                  )}
                >
                  <span className="opacity-50 mr-2">
                    {entry.level === "error" ? "✕" : entry.level === "warn" ? "⚠" : "›"}
                  </span>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/20">
        <p className="text-[10px] text-muted-foreground">
          {currentFiles.length} file{currentFiles.length !== 1 ? "s" : ""} ·{" "}
          {Object.keys(project.dependencies).length} dep{Object.keys(project.dependencies).length !== 1 ? "s" : ""}
          {hasEdits && " · edited"}
        </p>
        {hasEdits && (
          <button
            onClick={() => setEditedFiles({})}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset all edits
          </button>
        )}
      </div>
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
        existing = { name: part, path: fullPath, isDir: !isLast, children: [] };
        current.push(existing);
      }
      if (!isLast) current = existing.children;
    }
  }

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
  editedPaths,
}: {
  node: FileTreeNodeData;
  selectedFile: string;
  onSelect: (path: string) => void;
  depth: number;
  editedPaths: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.path === selectedFile;
  const isEdited = editedPaths[node.path] !== undefined;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight className={cn("w-3 h-3 shrink-0 transition-transform", expanded && "rotate-90")} />
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
              editedPaths={editedPaths}
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
      {isEdited && <span className="ml-auto text-primary text-[9px]">●</span>}
    </button>
  );
}

export default WebAppPreviewCard;
