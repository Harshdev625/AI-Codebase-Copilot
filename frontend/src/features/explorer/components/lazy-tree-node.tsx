import * as React from "react";
import { Folder, File, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useRepositoryTree } from "@/features/repositories/hooks/use-repositories";
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
  scopePaths = []
}: LazyTreeNodeProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{x: number, y: number} | null>(null);
  
  const { data, isLoading } = useRepositoryTree(
    repoId,
    isOpen && type === "DIRECTORY" ? path : undefined,
    snapshotId,
    patchId
  );

  const isContextAdded = scopePaths.includes(path);

  const handleClick = () => {
    if (type === "DIRECTORY") {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(path);
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
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setContextMenu(null);
  };

  return (
    <div className="flex flex-col select-none relative">
      <div 
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          "group flex items-center justify-between px-1.5 py-0.5 rounded-[4px] cursor-pointer hover:bg-accent text-[13px] font-medium transition-colors",
          status === "ADDED" && "text-success bg-success/5 hover:bg-success/10",
          status === "MODIFIED" && "text-primary bg-primary/5 hover:bg-primary/10",
          status === "DELETED" && "text-destructive line-through opacity-60 hover:bg-destructive/5"
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {type === "DIRECTORY" ? (
            <>
              <button 
                data-testid={`tree-folder-toggle-${path}`}
                className="focus:outline-none p-0.5"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
              </button>
              <Folder className={cn("w-4 h-4 shrink-0", isOpen ? "fill-blue-500/20 text-blue-500" : "text-muted-foreground")} />
            </>
          ) : (
            <File className="w-4 h-4 text-muted-foreground shrink-0 ml-[22px]" />
          )}
          <span 
            data-testid={type === "FILE" ? `tree-file-node-${path}` : undefined}
            className="truncate text-foreground/90 font-[family-name:var(--font-sans)]"
          >
            {name}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {status && status !== "INDEXED" && (
            <span 
              data-testid={`tree-node-status-${path}`}
              className={cn(
                "text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 mx-1",
                status === "ADDED" && "border-success/20 bg-success/15 text-success",
                status === "MODIFIED" && "border-primary/20 bg-primary/15 text-primary",
                status === "DELETED" && "border-destructive/20 bg-destructive/15 text-destructive"
              )}
            >
              {status[0]}
            </span>
          )}
          {type === "FILE" && onToggleContext && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleContext(path);
              }}
              title={isContextAdded ? "Remove from context" : "Add to context"}
              className={cn(
                "w-6 h-6 flex items-center justify-center rounded-md transition-colors",
                isContextAdded ? "text-primary hover:bg-destructive/10 hover:text-destructive opacity-100" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <div className="ml-3 pl-2 border-l border-border/40 flex flex-col gap-0.5 mt-0.5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1 text-[10px] text-muted-foreground/60">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            data?.items?.map((node) => (
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
                scopePaths={scopePaths}
              />
            ))
          )}
          {!isLoading && (!data?.items || data.items.length === 0) && (
            <span className="text-[10px] text-muted-foreground/50 italic py-1 pl-4">Empty Directory</span>
          )}
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed z-50 min-w-[160px] bg-card/80 backdrop-blur-xl border border-border/50 shadow-xl rounded-xl p-1.5 text-foreground text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {type === "FILE" && (
            <button 
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground rounded-sm"
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
            className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground rounded-sm"
            onClick={handleCopyPath}
          >
            Copy Path
          </button>
          {type === "FILE" && onToggleContext && (
            <button 
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground rounded-sm"
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
