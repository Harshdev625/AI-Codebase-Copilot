"use client";

import * as React from "react";
import { Search, Loader2, History, X } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LazyTreeNode } from "@/features/explorer/components/lazy-tree-node";
import { useChatSessions, useUpdateSessionMutation } from "@/features/chat/hooks/use-chat";
import {
  useRepositories,
  useRepositoryTree,
  useSnapshots,
} from "@/features/repositories/hooks/use-repositories";
import type { RepositorySnapshot } from "@/features/repositories/types/repository-types";
import { useStudioStore } from "../store/studio-store";

/**
 * Phase 2+ file explorer for the studio secondary panel.
 *
 * Features:
 * - Live file tree via LazyTreeNode (lazy-loads subdirectory contents on expand)
 * - Client-side filter on root-level items
 * - "Add to context" toggle that persists scope_paths to the active chat session
 * - Clicking a file calls openFileInEditor → switches canvasMode to 'editor' and loads file content
 * - Snapshot selector for browsing historical repository state at a specific commit
 */
export function StudioExplorerPanel() {
  const { selectedRepositoryId, activeSessionId, openFileInEditor } = useStudioStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find((r) => r.id === selectedRepositoryId);
  const [filterQuery, setFilterQuery] = React.useState("");

  // Historical browsing: selected snapshot
  const [selectedSnapshotId, setSelectedSnapshotId] = React.useState<string | null>(null);

  // Fetch available snapshots for the snapshot selector
  const snapshotsQuery = useSnapshots(selectedRepositoryId ?? "");
  const snapshots: RepositorySnapshot[] = snapshotsQuery.data?.snapshots ?? [];

  // Find the selected snapshot object (for commit SHA)
  const selectedSnapshot = selectedSnapshotId
    ? snapshots.find((s) => s.id === selectedSnapshotId) ?? null
    : null;

  // Use snapshotId when browsing historically; undefined = latest state
  const { data, isLoading } = useRepositoryTree(
    selectedRepositoryId ?? "",
    selectedRepositoryId ? "" : undefined,
    selectedSnapshotId ?? undefined
  );

  const { data: sessionData } = useChatSessions(100, 0);
  const updateSessionMutation = useUpdateSessionMutation();

  const activeSession = sessionData?.items?.find((s: any) => s.id === activeSessionId);
  const scopePaths: string[] = activeSession?.metadata?.scope_paths ?? [];

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return [];
    if (!filterQuery.trim()) return data.items;
    const lower = filterQuery.toLowerCase();
    return data.items.filter((item) => item.path.toLowerCase().includes(lower));
  }, [data?.items, filterQuery]);

  const handleFileSelect = (path: string) => {
    // In historical mode, pass commit SHA so StudioCanvasEditor loads the right version
    openFileInEditor(path, undefined, selectedSnapshot?.commit_sha ?? undefined);
  };

  const handleToggleContext = (path: string) => {
    // Disable scope toggling when browsing a historical snapshot
    if (!activeSessionId || selectedSnapshotId) return;
    const newPaths = scopePaths.includes(path)
      ? scopePaths.filter((p) => p !== path)
      : [...scopePaths, path];
    updateSessionMutation.mutate({
      sessionId: activeSessionId,
      payload: { metadata: { scope_paths: newPaths } },
    });
  };

  const handleClearSnapshot = () => setSelectedSnapshotId(null);

  if (!selectedRepository) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <p className="text-[#8B949E] text-sm">Select a repository to browse files.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter input */}
      <div className="px-3 py-3 shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B949E]" />
          <Input
            placeholder="Filter files..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-8 pl-9 text-[13px] bg-[#1A1C23] border-[#2D313E] text-[#C9D1D9] focus-visible:ring-1 focus-visible:ring-[#3B82F6] rounded-md placeholder:text-[#8B949E]"
          />
        </div>

        {/* Snapshot selector */}
        {snapshots.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Select
              value={selectedSnapshotId ?? "current"}
              onValueChange={(v) =>
                setSelectedSnapshotId(v === "current" ? null : v)
              }
            >
              <SelectTrigger className="h-7 text-[11px] bg-[#1A1C23] border-[#2D313E] text-[#C9D1D9] flex-1 rounded-md focus:ring-1 focus:ring-[#3B82F6] gap-1 px-2 [&>span]:truncate">
                <History className="w-3 h-3 shrink-0 text-[#8B949E]" />
                <SelectValue placeholder="Browse snapshot…" />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1F26] border-[#2D313E] text-[#C9D1D9] text-xs">
                <SelectItem value="current" className="text-[12px]">
                  Current (latest)
                </SelectItem>
                {snapshots
                  .filter((s) => s.index_status === "COMPLETE")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[12px]">
                      <span className="font-mono">{s.commit_sha.substring(0, 7)}</span>
                      {" · "}
                      {format(new Date(s.indexed_at), "MMM d, HH:mm")}
                      {s.is_pinned && " 📌"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {selectedSnapshotId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                onClick={handleClearSnapshot}
                title="Return to current state"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Historical mode indicator */}
        {selectedSnapshot && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <History className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-500 font-mono truncate">
              @{selectedSnapshot.commit_sha.substring(0, 7)} · read-only
            </span>
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[#8B949E]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">
              {selectedSnapshotId ? "Loading snapshot tree…" : "Loading file tree…"}
            </span>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {filteredItems.map((node) => (
              <LazyTreeNode
                key={node.id ?? node.path}
                repoId={selectedRepository.id}
                name={node.path.split("/").pop() ?? node.path}
                path={node.path}
                type={node.type}
                status={node.status}
                onFileSelect={handleFileSelect}
                // Disable context toggling when browsing a snapshot (read-only historical view)
                onToggleContext={
                  activeSessionId && !selectedSnapshotId ? handleToggleContext : undefined
                }
                scopePaths={scopePaths}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-[#8B949E] text-xs italic">
              {filterQuery ? "No files matching filter." : "No files found."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
