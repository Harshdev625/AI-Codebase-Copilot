import * as React from "react";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useRepositoryTree } from "@/features/repositories/hooks/use-repositories";
import { repositoryService } from "@/features/repositories/services/repository-service";
import type { TreeItem } from "@/features/repositories/types/repository-types";
import { sortTreeItems } from "@/features/explorer/utils/sort-tree-items";
import { FileIcon } from "@/features/studio/components/file-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LazyTreeNodeProps {
  repoId: string;
  name: string;
  path: string;
  type: "FILE" | "DIRECTORY";
  snapshotId?: string;
  patchId?: string;
  status?: "INDEXED" | "ADDED" | "MODIFIED" | "DELETED" | string;
  onFileSelect: (path: string, size?: number) => void;
  onToggleContext?: (path: string) => void;
  contextDisabledReason?: string;
  scopePaths?: string[];
}

export function LazyTreeNode({
  repoId,
  name,
  path,
  type,
  snapshotId,
  patchId,
  status = "INDEXED",
  onFileSelect,
  onToggleContext,
  contextDisabledReason,
  scopePaths = [],
}: LazyTreeNodeProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [childItems, setChildItems] = React.useState<TreeItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [loadingMore, setLoadingMore] = React.useState(false);

  const { data, isLoading } = useRepositoryTree(
    repoId,
    isOpen && type === "DIRECTORY" ? path : undefined,
    snapshotId,
    patchId,
  );

  React.useEffect(() => {
    if (!isOpen || type !== "DIRECTORY") {
      setChildItems([]);
      setNextCursor(undefined);
      return;
    }
    if (data?.items) {
      setChildItems(sortTreeItems(data.items));
      setNextCursor(data.next_cursor);
    }
  }, [data, isOpen, type, path]);

  const isContextAdded = scopePaths.includes(path);

  const toggleDirectory = () => {
    if (type === "DIRECTORY") {
      setIsOpen((open) => !open);
    }
  };

  const handleClick = () => {
    if (type === "DIRECTORY") {
      toggleDirectory();
    } else {
      onFileSelect(path);
    }
  };

  const handleLoadMore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await repositoryService.getTree(
        repoId,
        path,
        snapshotId,
        patchId,
        nextCursor,
      );
      setChildItems((prev) => sortTreeItems([...prev, ...page.items]));
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setContextMenu(null);
  };

  return (
    <div className="relative flex flex-col select-none">
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          "group flex cursor-pointer items-center justify-between rounded-[4px] px-1.5 py-0.5 text-[13px] font-medium transition-colors hover:bg-accent",
          status === "ADDED" && "bg-success/5 text-success hover:bg-success/10",
          status === "MODIFIED" && "bg-primary/5 text-primary hover:bg-primary/10",
          status === "DELETED" && "text-destructive line-through opacity-60 hover:bg-destructive/5",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          {type === "DIRECTORY" ? (
            <>
              <button
                type="button"
                data-testid={`tree-folder-toggle-${path}`}
                className="p-0.5 focus:outline-none"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Collapse ${name}` : `Expand ${name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDirectory();
                }}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              <FileIcon path={path} isDirectory isOpen={isOpen} />
            </>
          ) : (
            <FileIcon path={path} className="ml-[22px] shrink-0" />
          )}
          <span
            data-testid={type === "FILE" ? `tree-file-node-${path}` : undefined}
            className="truncate font-[family-name:var(--font-sans)] text-foreground/90"
          >
            {name}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {status && status !== "INDEXED" && (
            <span
              data-testid={`tree-node-status-${path}`}
              className={cn(
                "mx-1 shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                status === "ADDED" && "border-success/20 bg-success/15 text-success",
                status === "MODIFIED" && "border-primary/20 bg-primary/15 text-primary",
                status === "DELETED" && "border-destructive/20 bg-destructive/15 text-destructive",
              )}
            >
              {status[0]}
            </span>
          )}
          {type === "FILE" && (onToggleContext || contextDisabledReason) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleContext) onToggleContext(path);
              }}
              disabled={!onToggleContext}
              title={
                onToggleContext
                  ? isContextAdded
                    ? "Remove from context"
                    : "Add to context"
                  : contextDisabledReason
              }
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                isContextAdded
                  ? "text-primary opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isContextAdded ? (
                  <path d="M20 6L9 17l-5-5" />
                ) : (
                  <>
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </>
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {isOpen && type === "DIRECTORY" && (
        <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-border/40 pl-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground/60">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            childItems.map((node) => (
              <LazyTreeNode
                key={node.id || node.path}
                repoId={repoId}
                name={node.path.split("/").pop() || node.path}
                path={node.path}
                type={node.type}
                snapshotId={snapshotId}
                patchId={patchId}
                status={node.status}
                onFileSelect={onFileSelect}
                onToggleContext={onToggleContext}
                contextDisabledReason={contextDisabledReason}
                scopePaths={scopePaths}
              />
            ))
          )}
          {!isLoading && childItems.length === 0 && (
            <span className="py-1 pl-4 text-[10px] text-muted-foreground/50 italic">
              Empty Directory
            </span>
          )}
          {nextCursor ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 justify-start pl-4 text-[11px] text-muted-foreground"
              disabled={loadingMore}
              onClick={handleLoadMore}
            >
              {loadingMore ? (
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
      )}

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-xl border border-border/50 bg-card/80 p-1.5 text-sm text-foreground shadow-xl backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {type === "FILE" && (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(path);
                setContextMenu(null);
              }}
            >
              Open File
            </button>
          )}
          <button
            type="button"
            className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            onClick={handleCopyPath}
          >
            Copy Path
          </button>
          {type === "FILE" && onToggleContext && (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onToggleContext(path);
                setContextMenu(null);
              }}
            >
              {isContextAdded ? "Remove from Context" : "Add to Context"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
