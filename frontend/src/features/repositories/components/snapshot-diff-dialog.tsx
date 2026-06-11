import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSnapshotDiff } from "../hooks/use-repositories";
import { repositoryService } from "../services/repository-service";
import { MonacoDiffViewer } from "@/features/workspace/components/monaco-diff-viewer";
import { Loader2, Plus, Minus, FileEdit, ArrowRightLeft, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnapshotDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId: string;
  snapshotId: string;
  compareWithId: string;
  snapshotSha?: string;
  compareSha?: string;
}

interface FileDiffState {
  file: string;
  originalContent: string | null;
  modifiedContent: string | null;
  isLoading: boolean;
  error: string | null;
}

export function SnapshotDiffDialog({
  isOpen,
  onClose,
  repositoryId,
  snapshotId,
  compareWithId,
  snapshotSha = "",
  compareSha = "",
}: SnapshotDiffDialogProps) {
  const { data, isLoading, isError, error } = useSnapshotDiff(
    repositoryId,
    snapshotId,
    compareWithId
  );

  const [fileDiff, setFileDiff] = React.useState<FileDiffState | null>(null);

  const displayShaA = snapshotSha.substring(0, 8) || snapshotId.substring(0, 8);
  const displayShaB = compareSha.substring(0, 8) || compareWithId.substring(0, 8);

  const inDiffView = fileDiff !== null;

  const handleOpenFileDiff = React.useCallback(
    async (file: string) => {
      if (!snapshotSha || !compareSha) return;

      setFileDiff({ file, originalContent: null, modifiedContent: null, isLoading: true, error: null });

      try {
        const [originalRes, modifiedRes] = await Promise.all([
          repositoryService.getFileContent(repositoryId, file, snapshotSha),
          repositoryService.getFileContent(repositoryId, file, compareSha),
        ]);
        setFileDiff({
          file,
          originalContent: originalRes.content ?? "",
          modifiedContent: modifiedRes.content ?? "",
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setFileDiff({
          file,
          originalContent: null,
          modifiedContent: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load file content.",
        });
      }
    },
    [repositoryId, snapshotSha, compareSha]
  );

  const handleBackToList = () => setFileDiff(null);

  const handleDialogClose = () => {
    setFileDiff(null);
    onClose();
  };

  const canOpenFileDiff = !!snapshotSha && !!compareSha;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl rounded-2xl transition-all duration-200",
          inDiffView ? "max-w-5xl max-h-[90vh]" : "max-w-xl max-h-[85vh]"
        )}
      >
        <DialogHeader className="p-4 border-b border-border/40 bg-card/30 shrink-0">
          <DialogTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              {inDiffView && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground mr-1"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              {inDiffView ? (
                <span className="font-mono text-sm truncate max-w-[280px]" title={fileDiff?.file}>
                  {fileDiff?.file?.split("/").pop()}
                </span>
              ) : (
                "Snapshot Comparison"
              )}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded border border-border/30">
              <span className="text-foreground font-semibold">{displayShaA}</span>
              <span>↔</span>
              <span className="text-foreground font-semibold">{displayShaB}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ---------------------------------------------------------------- */}
        {/* File diff view                                                   */}
        {/* ---------------------------------------------------------------- */}
        {inDiffView ? (
          <div className="flex-1 min-h-0">
            {fileDiff!.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-mono">Loading file diff…</span>
              </div>
            ) : fileDiff!.error ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-destructive gap-2">
                <span className="text-sm font-semibold">Failed to load diff</span>
                <span className="text-xs opacity-70">{fileDiff!.error}</span>
              </div>
            ) : fileDiff!.originalContent !== null && fileDiff!.modifiedContent !== null ? (
              <MonacoDiffViewer
                originalContent={fileDiff!.originalContent}
                modifiedContent={fileDiff!.modifiedContent}
                filePath={fileDiff!.file}
              />
            ) : null}
          </div>
        ) : (
          /* ---------------------------------------------------------------- */
          /* File list view                                                   */
          /* ---------------------------------------------------------------- */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground/60">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-mono">Running hash-based diffing…</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">
                <span className="text-sm font-semibold">Failed to load diff</span>
                <span className="text-xs mt-1 opacity-70">
                  {(error as any)?.message || "Unknown error occurred"}
                </span>
              </div>
            ) : data ? (
              <div className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold py-2 border-b border-border/10 font-mono">
                  <div className="text-success bg-success/5 border border-success/15 py-1.5 rounded-lg">
                    +{data.added?.length || 0} Added
                  </div>
                  <div className="text-destructive bg-destructive/5 border border-destructive/15 py-1.5 rounded-lg">
                    -{data.removed?.length || 0} Removed
                  </div>
                  <div className="text-primary bg-primary/5 border border-primary/15 py-1.5 rounded-lg">
                    {data.modified?.length || 0} Modified
                  </div>
                  <div className="text-amber-500 bg-amber-500/5 border border-amber-500/15 py-1.5 rounded-lg">
                    {data.renamed?.length || 0} Renamed
                  </div>
                </div>

                <div className="space-y-3 font-mono text-[11.5px]">
                  {/* Added */}
                  {data.added && data.added.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-success/80 uppercase tracking-widest px-1">
                        Added
                      </span>
                      <div className="border border-success/10 rounded-lg p-2 bg-success/5 flex flex-col gap-1">
                        {data.added.map((file) => (
                          <div key={file} className="flex items-center gap-2 text-success/90">
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed */}
                  {data.removed && data.removed.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-destructive/80 uppercase tracking-widest px-1">
                        Removed
                      </span>
                      <div className="border border-destructive/10 rounded-lg p-2 bg-destructive/5 flex flex-col gap-1">
                        {data.removed.map((file) => (
                          <div
                            key={file}
                            className="flex items-center gap-2 text-destructive/90 line-through opacity-70"
                          >
                            <Minus className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Renamed */}
                  {data.renamed && data.renamed.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest px-1">
                        Renamed
                      </span>
                      <div className="border border-amber-500/10 rounded-lg p-2 bg-amber-500/5 flex flex-col gap-1">
                        {data.renamed.map((r, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-amber-500/90">
                            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {r.from} → {r.to}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modified — clickable if SHAs available */}
                  {data.modified && data.modified.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest px-1">
                        Modified{canOpenFileDiff && " — click to diff"}
                      </span>
                      <div className="border border-primary/10 rounded-lg p-2 bg-primary/5 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {data.modified.map((file) => (
                          <div
                            key={file}
                            className={cn(
                              "flex items-center gap-2 text-primary/90 rounded px-1 py-0.5 transition-colors",
                              canOpenFileDiff &&
                                "cursor-pointer hover:bg-primary/10 hover:text-primary"
                            )}
                            onClick={() => canOpenFileDiff && handleOpenFileDiff(file)}
                            title={canOpenFileDiff ? "Click to view diff" : undefined}
                          >
                            <FileEdit className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate flex-1">{file}</span>
                            {canOpenFileDiff && (
                              <ArrowRightLeft className="w-3 h-3 shrink-0 opacity-40" />
                            )}
                          </div>
                        ))}
                      </div>
                      {!canOpenFileDiff && (
                        <p className="text-[10px] text-muted-foreground/60 px-1 italic">
                          Commit SHAs not available — cannot open file diff.
                        </p>
                      )}
                    </div>
                  )}

                  {!data.added?.length &&
                    !data.removed?.length &&
                    !data.modified?.length &&
                    !data.renamed?.length && (
                      <div className="text-center py-8 text-muted-foreground/60 italic text-xs">
                        No files changed between these snapshots.
                      </div>
                    )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border/40 bg-card/25 flex justify-between items-center shrink-0">
          {inDiffView ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleBackToList}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to file list
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={handleDialogClose} className="h-8 text-xs font-semibold px-4">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
