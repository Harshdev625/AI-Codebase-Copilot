"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

import { repositoryService } from "@/features/repositories/services/repository-service";
import { useStudioStore } from "@/features/studio/store/studio-store";

/**
 * Single Monaco editor instance — updates model when active file tab changes.
 * Avoids mounting multiple Editor widgets (memory-safe tab strategy).
 */
export function MonacoEditorHost({
  filePath,
  commitSha,
  initialLine,
}: {
  filePath: string;
  commitSha?: string;
  initialLine?: number;
}): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const { editorWordWrap, editorMinimap } = useStudioStore();
  const editorRef = React.useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>["onMount"]>>[0] | null>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const selectedRepositoryId = useStudioStore((s) => s.selectedRepositoryId);

  const language = React.useMemo(() => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "json":
        return "json";
      case "py":
        return "python";
      case "md":
        return "markdown";
      case "html":
        return "html";
      case "css":
        return "css";
      default:
        return "plaintext";
    }
  }, [filePath]);

  React.useEffect(() => {
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
  }, [selectedRepositoryId, filePath, commitSha]);

  React.useEffect(() => {
    if (editorRef.current && initialLine) {
      editorRef.current.revealLineInCenter(initialLine);
      editorRef.current.setPosition({ lineNumber: initialLine, column: 1 });
    }
  }, [initialLine, filePath, content]);

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

  return (
    <div className="h-full w-full min-h-0" data-testid="monaco-editor-host">
      <Editor
        height="100%"
        width="100%"
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
        language={language}
        path={filePath}
        value={content ?? ""}
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
