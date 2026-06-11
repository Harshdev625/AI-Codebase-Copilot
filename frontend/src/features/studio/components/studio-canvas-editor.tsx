"use client";

import * as React from "react";
import { ArrowLeft, Loader2, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { MonacoViewer } from "@/features/studio/panels/monaco-viewer";

import { useStudioStore } from "../store/studio-store";

/**
 * Phase 3 — Editor canvas mode.
 *
 * Activated when canvasMode === 'editor'.
 * Reads activeFilePath + activeFileInitialLine from the studio store,
 * fetches file content from the repository API, then renders MonacoViewer.
 *
 * Triggers:
 *   - Clicking a file in StudioExplorerPanel  (openFileInEditor)
 *   - Clicking a search result in SearchPanel (onResultClick callback)
 *
 * Back navigation: ArrowLeft header button returns to 'chat' mode without losing the
 * chat session state. Nav-rail chat icon also switches back.
 */
export function StudioCanvasEditor() {
  const {
    activeFilePath,
    activeFileInitialLine,
    activeFileCommitSha,
    selectedRepositoryId,
    setCanvasMode,
  } = useStudioStore();

  const [content, setContent] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeFilePath || !selectedRepositoryId) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setContent(null);

    repositoryService
      .getFileContent(selectedRepositoryId, activeFilePath, activeFileCommitSha)
      .then((res) => {
        if (!cancelled) setContent(res.content ?? "");
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load file content.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilePath, selectedRepositoryId, activeFileCommitSha]);

  if (!activeFilePath) {
    return (
      <StudioCanvasEmptyState
        icon={<FileCode2 className="w-8 h-8 text-[#8B949E]" />}
        title="No file open"
        description="Select a file from the Explorer panel or click a search result to open it here."
        onBack={() => setCanvasMode("chat")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0D14]">
      {/* Breadcrumb / file header */}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[#1E212B] shrink-0 bg-[#13151A]">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23] shrink-0"
          onClick={() => setCanvasMode("chat")}
          title="Back to Chat"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <FileCode2 className="w-3.5 h-3.5 text-[#8B949E] shrink-0" />
        <span className="text-[#C9D1D9] text-[12px] font-mono truncate" title={activeFilePath}>
          {activeFilePath}
        </span>
        {activeFileCommitSha && (
          <span className="ml-auto shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500">
            @{activeFileCommitSha.substring(0, 7)}
          </span>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D14] z-10">
            <div className="flex items-center gap-2 text-[#8B949E]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <p className="text-destructive text-sm text-center">{error}</p>
          </div>
        )}
        {content !== null && !isLoading && (
          <MonacoViewer
            content={content}
            filePath={activeFilePath}
            readOnly
            initialLine={activeFileInitialLine}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared empty-state helper used by editor and patch-review canvas modes
// ---------------------------------------------------------------------------

export function StudioCanvasEmptyState({
  icon,
  title,
  description,
  onBack,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center gap-4 bg-[#0B0D14] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1A1C23] border border-[#2D313E] flex items-center justify-center shadow-lg">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-[#E2E8F0] text-base font-semibold">{title}</h3>
        <p className="text-[#8B949E] text-sm max-w-xs">{description}</p>
      </div>
      {onBack && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 border-[#2D313E] text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Chat
        </Button>
      )}
    </div>
  );
}
