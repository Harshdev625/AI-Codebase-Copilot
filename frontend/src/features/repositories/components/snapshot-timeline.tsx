import * as React from "react";
import { useSnapshots, useUpdateSnapshotMutation } from "../hooks/use-repositories";
import { SnapshotTimelineItem } from "./snapshot-timeline-item";
import { SnapshotDiffDialog } from "./snapshot-diff-dialog";
import { Loader2, ArrowRightLeft, Clock, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RepositorySnapshot } from "../types/repository-types";
import { useStudioStore } from "@/features/studio/store/studio-store";

interface SnapshotTimelineProps {
  repositoryId: string;
}

export function SnapshotTimeline({ repositoryId }: SnapshotTimelineProps) {
  const { data, isLoading, isError, error } = useSnapshots(repositoryId);
  const updateMutation = useUpdateSnapshotMutation(repositoryId);
  const { setSelectedSnapshotId, focusSidebar } = useStudioStore();

  // Compare selection state (store up to 2 snapshot IDs)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isDiffOpen, setIsDiffOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleBrowseInExplorer = (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId);
    focusSidebar("explorer");
  };

  const handleSelectForCompare = (snapshotId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(snapshotId)) {
        return prev.filter((id) => id !== snapshotId);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], snapshotId];
      }
      return [...prev, snapshotId];
    });
  };

  const handleTogglePin = (snapshotId: string, isPinned: boolean) => {
    updateMutation.mutate({
      snapshotId,
      payload: { is_pinned: isPinned }
    });
  };

  const snapshots: RepositorySnapshot[] = data?.snapshots || [];
  
  const filteredSnapshots = React.useMemo(() => {
    if (!searchQuery.trim()) return snapshots;
    const lowerQ = searchQuery.toLowerCase();
    return snapshots.filter((s) => 
      s.commit_sha?.toLowerCase().includes(lowerQ) || 
      (s as any).commit_message?.toLowerCase().includes(lowerQ) ||
      s.id.toLowerCase().includes(lowerQ)
    );
  }, [snapshots, searchQuery]);

  // Find SHAs for display in the comparison header
  const getSelectedShas = () => {
    if (selectedIds.length < 2) return { shaA: "", shaB: "" };
    const snapA = snapshots.find((s: RepositorySnapshot) => s.id === selectedIds[0]);
    const snapB = snapshots.find((s: RepositorySnapshot) => s.id === selectedIds[1]);
    return {
      shaA: snapA?.commit_sha || "",
      shaB: snapB?.commit_sha || ""
    };
  };

  const { shaA, shaB } = getSelectedShas();

  return (
    <div className="flex flex-col gap-4 border border-border/40 rounded-xl bg-card/10 p-5 shadow-sm w-full">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground truncate">Snapshot Retention Timeline</h3>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search snapshots (commit, message)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

        {selectedIds.length === 2 && (
          <Button
            size="sm"
            onClick={() => setIsDiffOpen(true)}
            className="h-8 text-xs font-bold gap-1.5 shadow-glow-sm bg-amber-600 hover:bg-amber-500 text-white border-amber-600/30"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Compare Selected ({selectedIds.length})
          </Button>
        )}
      </div>
      </div>

      {/* Snapshots viewport */}
      <div className="max-h-[480px] overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground/60">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Fetching retention history...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">
            <span className="text-sm font-semibold">Failed to load snapshots</span>
            <span className="text-xs mt-1 opacity-70">{(error as any)?.message || "Unknown error occurred"}</span>
          </div>
        ) : filteredSnapshots.length > 0 ? (
          filteredSnapshots.map((snap: RepositorySnapshot) => (
            <SnapshotTimelineItem
              key={snap.id}
              snapshot={snap}
              onTogglePin={handleTogglePin}
              isPinPending={updateMutation.isPending}
              onSelectForCompare={handleSelectForCompare}
              isSelectedForCompare={selectedIds.includes(snap.id)}
              compareCount={selectedIds.length}
              onBrowseInExplorer={handleBrowseInExplorer}
            />
          ))
        ) : (
          <div className="text-center py-16 text-muted-foreground/50 italic text-xs flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 opacity-30" />
            <span>No historical snapshots exist. Run an indexing job first.</span>
          </div>
        )}
      </div>

      {/* Diff comparison dialog */}
      {selectedIds.length === 2 && (
        <SnapshotDiffDialog
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
          repositoryId={repositoryId}
          snapshotId={selectedIds[0]}
          compareWithId={selectedIds[1]}
          snapshotSha={shaA}
          compareSha={shaB}
        />
      )}
    </div>
  );
}
