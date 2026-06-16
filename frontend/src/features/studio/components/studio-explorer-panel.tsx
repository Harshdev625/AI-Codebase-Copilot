"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Loader2, History, X, AlertCircle } from "lucide-react";
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
import { sortTreeItems } from "@/features/explorer/utils/sort-tree-items";
import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import {
  useRepositories,
  useRepositoryTree,
  useSnapshots,
  useRepositoryInsights,
} from "@/features/repositories/hooks/use-repositories";
import { repositoryService } from "@/features/repositories/services/repository-service";
import type { RepositorySnapshot, TreeItem } from "@/features/repositories/types/repository-types";
import { useStudioStore } from "../store/studio-store";

export function StudioExplorerPanel() {
  const {
    selectedRepositoryId,
    activeSessionId,
    selectedSnapshotId,
    setSelectedSnapshotId,
    openFileTab,
  } = useStudioStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find((r) => r.id === selectedRepositoryId);
  const [filterQuery, setFilterQuery] = React.useState("");
  const [rootItems, setRootItems] = React.useState<TreeItem[]>([]);
  const [rootNextCursor, setRootNextCursor] = React.useState<string | undefined>();
  const [loadingMoreRoot, setLoadingMoreRoot] = React.useState(false);

  const snapshotsQuery = useSnapshots(selectedRepositoryId ?? "");
  const snapshots: RepositorySnapshot[] = snapshotsQuery.data?.snapshots ?? [];

  const selectedSnapshot = selectedSnapshotId
    ? snapshots.find((s) => s.id === selectedSnapshotId) ?? null
    : null;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useRepositoryTree(
    selectedRepositoryId ?? "",
    selectedRepositoryId ? "" : undefined,
    selectedSnapshotId ?? undefined,
  );

  React.useEffect(() => {
    if (data?.items) {
      setRootItems(sortTreeItems(data.items));
      setRootNextCursor(data.next_cursor);
    } else {
      setRootItems([]);
      setRootNextCursor(undefined);
    }
  }, [data, selectedRepositoryId, selectedSnapshotId]);

  const { scopePaths, toggleScopePath } = useSessionScope(activeSessionId);

  const filteredItems = React.useMemo(() => {
    if (!rootItems.length) return [];
    const sorted = sortTreeItems(rootItems);
    if (!filterQuery.trim()) return sorted;
    const lower = filterQuery.toLowerCase();
    return sorted.filter((item) => item.path.toLowerCase().includes(lower));
  }, [rootItems, filterQuery]);

  const insightsQuery = useRepositoryInsights(selectedRepositoryId ?? "");
  const indexedFileCount = insightsQuery.data?.files_indexed ?? 0;

  const handleFileSelect = (path: string) => {
    openFileTab(path, undefined, selectedSnapshot?.commit_sha ?? undefined);
  };

  const handleToggleContext = (path: string) => {
    if (!activeSessionId || selectedSnapshotId) return;
    toggleScopePath(path);
  };

  const handleClearSnapshot = () => setSelectedSnapshotId(null);

  const handleLoadMoreRoot = async () => {
    if (!selectedRepositoryId || !rootNextCursor || loadingMoreRoot) return;
    setLoadingMoreRoot(true);
    try {
      const page = await repositoryService.getTree(
        selectedRepositoryId,
        "",
        selectedSnapshotId ?? undefined,
        undefined,
        rootNextCursor,
      );
      setRootItems((prev) => sortTreeItems([...prev, ...page.items]));
      setRootNextCursor(page.next_cursor);
    } finally {
      setLoadingMoreRoot(false);
    }
  };

  const contextToggle = activeSessionId && !selectedSnapshotId ? handleToggleContext : undefined;
  const contextDisabledReason = !activeSessionId
    ? "Start or select a chat session to add files to context"
    : selectedSnapshotId
      ? "Context pinning is unavailable in snapshot browse mode"
      : undefined;

  if (!selectedRepository) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-[#8B949E]">Select a repository to browse files.</p>
      </div>
    );
  }

  const showEmptyIndexState =
    !isLoading &&
    !isError &&
    !filterQuery.trim() &&
    filteredItems.length === 0 &&
    indexedFileCount === 0 &&
    !selectedSnapshotId;

  const showIndexingBanner =
    !isLoading &&
    filteredItems.length > 0 &&
    indexedFileCount === 0 &&
    !selectedSnapshotId;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 px-3 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#8B949E]" />
          <Input
            placeholder="Filter visible items…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-8 rounded-md border-[#2D313E] bg-[#1A1C23] pl-9 text-[13px] text-[#C9D1D9] placeholder:text-[#8B949E] focus-visible:ring-1 focus-visible:ring-[#3B82F6]"
          />
        </div>
        {filterQuery.trim() && (
          <p className="px-1 text-[10px] text-[#8B949E]">
            Filtering root-level items only. Expand folders to browse nested files.
          </p>
        )}

        {snapshots.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Select
              value={selectedSnapshotId ?? "current"}
              onValueChange={(v) => setSelectedSnapshotId(v === "current" ? null : v)}
            >
              <SelectTrigger className="h-7 flex-1 gap-1 rounded-md border-[#2D313E] bg-[#1A1C23] px-2 text-[11px] text-[#C9D1D9] focus:ring-1 focus:ring-[#3B82F6] [&>span]:truncate">
                <History className="h-3 w-3 shrink-0 text-[#8B949E]" />
                <SelectValue placeholder="Browse snapshot…" />
              </SelectTrigger>
              <SelectContent className="border-[#2D313E] bg-[#1C1F26] text-xs text-[#C9D1D9]">
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
                className="h-7 w-7 shrink-0 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                onClick={handleClearSnapshot}
                title="Return to current state"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}

        {selectedSnapshot && (
          <div className="flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1">
            <History className="h-3 w-3 shrink-0 text-amber-500" />
            <span className="truncate font-mono text-[10px] text-amber-500">
              @{selectedSnapshot.commit_sha.substring(0, 7)} · read-only
            </span>
          </div>
        )}

        {showIndexingBanner && (
          <p className="px-1 text-[10px] text-amber-500/90">
            Indexing may still be in progress — showing available tree entries.
          </p>
        )}
      </div>

        <div className="flex-1 overflow-y-auto px-1 pb-3 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[#8B949E]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">
              {selectedSnapshotId ? "Loading snapshot tree…" : "Loading file tree…"}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/70" />
            <p className="text-xs text-[#C9D1D9]">Failed to load file tree</p>
            <p className="text-[10px] text-[#8B949E]">
              {(error as Error)?.message ?? "Unknown error"}
            </p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : showEmptyIndexState ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <p className="text-xs text-[#C9D1D9]">No indexed files yet</p>
            <p className="text-[10px] text-[#8B949E]">
              Index this repository from the dashboard to browse files here.
            </p>
            <Link href="/dashboard" className="text-[11px] text-[#58A6FF] hover:underline">
              Go to Dashboard →
            </Link>
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
                snapshotId={selectedSnapshotId ?? undefined}
                onFileSelect={handleFileSelect}
                onToggleContext={contextToggle}
                contextDisabledReason={contextDisabledReason}
                scopePaths={scopePaths}
              />
            ))}
            {!filterQuery.trim() && rootNextCursor ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 justify-start text-[11px] text-muted-foreground"
                disabled={loadingMoreRoot}
                onClick={() => void handleLoadMoreRoot()}
              >
                {loadingMoreRoot ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Loading more…
                  </>
                ) : (
                  "Load more…"
                )}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-[#8B949E] italic">
              {filterQuery ? "No files matching filter." : "No files found."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
