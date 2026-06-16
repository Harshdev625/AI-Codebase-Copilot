"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Eye, FileCode2, Loader2, Columns2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { useStudioStore } from "@/features/studio/store/studio-store";
import type { MarkdownViewMode } from "@/features/studio/types/studio-types";
import { MonacoEditorHost } from "./monaco-editor-host";
import { MarkdownFileViewer } from "./markdown-file-viewer";

function isMarkdownPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

function MarkdownMonacoPane({
  filePath,
  content,
  initialLine,
}: {
  filePath: string;
  content: string;
  initialLine?: number;
}): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const { editorWordWrap, editorMinimap } = useStudioStore();
  const editorRef = React.useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>["onMount"]>>[0] | null>(null);

  React.useEffect(() => {
    if (editorRef.current && initialLine) {
      editorRef.current.revealLineInCenter(initialLine);
      editorRef.current.setPosition({ lineNumber: initialLine, column: 1 });
    }
  }, [initialLine, filePath, content]);

  return (
    <div className="h-full w-full min-h-0" data-testid="monaco-editor-host">
      <Editor
        height="100%"
        width="100%"
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
        language="markdown"
        path={filePath}
        value={content}
        onMount={(editor) => {
          editorRef.current = editor;
          if (initialLine) {
            editor.revealLineInCenter(initialLine);
            editor.setPosition({ lineNumber: initialLine, column: 1 });
          }
        }}
        options={{
          readOnly: true,
          minimap: { enabled: editorMinimap },
          wordWrap: editorWordWrap ? "on" : "off",
          fontSize: 14,
          fontFamily: "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}

export function FileTabContent({
  tabId,
  filePath,
  commitSha,
  initialLine,
  viewMode = "source",
}: {
  tabId: string;
  filePath: string;
  commitSha?: string;
  initialLine?: number;
  viewMode?: MarkdownViewMode;
}): React.JSX.Element {
  const selectedRepositoryId = useStudioStore((s) => s.selectedRepositoryId);
  const setTabViewMode = useStudioStore((s) => s.setTabViewMode);
  const [content, setContent] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const isMarkdown = isMarkdownPath(filePath);

  React.useEffect(() => {
    if (!isMarkdown) return;
    if (!selectedRepositoryId) {
      setError("No repository selected.");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    repositoryService
      .getFileContent(selectedRepositoryId, filePath, commitSha)
      .then((res) => {
        if (!cancelled) setContent(res.content ?? "");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMarkdown, selectedRepositoryId, filePath, commitSha]);

  if (!isMarkdown) {
    return (
      <MonacoEditorHost
        filePath={filePath}
        commitSha={commitSha}
        initialLine={initialLine}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center studio-chrome-bg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const modeButton = (mode: MarkdownViewMode, label: string, icon: React.ReactNode) => (
    <Button
      key={mode}
      type="button"
      size="sm"
      variant={viewMode === mode ? "secondary" : "ghost"}
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={() => setTabViewMode(tabId, mode)}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b border-[#1E212B] bg-[#13151A] px-2 py-1"
        data-testid="markdown-view-toolbar"
      >
        {modeButton("source", "Source", <FileCode2 className="h-3.5 w-3.5" />)}
        {modeButton("preview", "Preview", <Eye className="h-3.5 w-3.5" />)}
        {modeButton("split", "Split", <Columns2 className="h-3.5 w-3.5" />)}
      </div>

      <div
        className={cn(
          "relative min-h-0 flex-1",
          viewMode === "split" && "grid grid-rows-2",
        )}
      >
        {(viewMode === "source" || viewMode === "split") && (
          <MarkdownMonacoPane
            filePath={filePath}
            content={content ?? ""}
            initialLine={initialLine}
          />
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={cn(viewMode === "split" && "border-t border-[#1E212B]")}>
            <MarkdownFileViewer content={content ?? ""} />
          </div>
        )}
      </div>
    </div>
  );
}
