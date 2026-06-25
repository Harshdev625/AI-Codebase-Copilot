import * as React from "react";
import { Pin, Calendar, HardDrive, ArrowRightLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RepositorySnapshot } from "../types/repository-types";

interface SnapshotTimelineItemProps {
  snapshot: RepositorySnapshot;
  onTogglePin: (snapshotId: string, isPinned: boolean) => void;
  isPinPending: boolean;
  onSelectForCompare: (snapshotId: string) => void;
  isSelectedForCompare: boolean;
  compareCount: number;
  onBrowseInExplorer?: (snapshotId: string) => void;
}

export function SnapshotTimelineItem({
  snapshot,
  onTogglePin,
  isPinPending,
  onSelectForCompare,
  isSelectedForCompare,
  compareCount,
  onBrowseInExplorer,
}: SnapshotTimelineItemProps) {
  return (
    <div 
      data-testid={`snapshot-timeline-item-${snapshot.id}`}
      className={cn(
        "flex items-start gap-4 p-4 border rounded-xl transition-all duration-300 bg-card/25 hover:bg-card/45",
        snapshot.is_pinned ? "border-primary/30 shadow-[0_0_12px_rgba(var(--primary-rgb),0.05)]" : "border-border/40",
        isSelectedForCompare && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      {/* Icon node in timeline vertical alignment */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center border transition-colors",
          snapshot.is_pinned 
            ? "bg-primary/20 border-primary text-primary" 
            : "bg-accent/40 border-border text-muted-foreground/60"
        )}>
          <HardDrive className="w-4 h-4" />
        </div>
        <div className="w-0.5 h-12 bg-border/20 mt-1.5" />
      </div>

      {/* Snapshot Content details */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs font-bold text-foreground bg-accent/80 px-2 py-0.5 rounded border border-border/50 truncate">
              {snapshot.commit_sha.substring(0, 8)}
            </span>
            {snapshot.is_release && (
              <Badge className="bg-success/20 text-success border border-success/30 text-[9px] uppercase font-bold tracking-wider">
                Release
              </Badge>
            )}
            {snapshot.is_pinned && (
              <Badge data-testid="snapshot-pinned-badge" className="bg-primary/20 text-primary border border-primary/30 text-[9px] uppercase font-bold tracking-wider">
                Pinned
              </Badge>
            )}
            <Badge className={cn(
              "text-[9px] uppercase font-bold tracking-wider border",
              snapshot.index_status === "COMPLETE" && "bg-success/10 text-success border-success/20",
              snapshot.index_status === "RUNNING" && "bg-primary/10 text-primary border-primary/20 animate-pulse",
              snapshot.index_status === "FAILED" && "bg-destructive/10 text-destructive border-destructive/20"
            )}>
              {snapshot.index_status}
            </Badge>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {snapshot.index_status === "COMPLETE" && onBrowseInExplorer && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBrowseInExplorer(snapshot.id)}
                className="h-7 text-[10px] px-2 border-border/50 gap-1"
              >
                <FolderOpen className="w-3 h-3" />
                Browse
              </Button>
            )}
            {/* Compare Toggle Button */}
            <Button
              size="sm"
              variant={isSelectedForCompare ? "secondary" : "outline"}
              onClick={() => onSelectForCompare(snapshot.id)}
              disabled={!isSelectedForCompare && compareCount >= 2}
              className={cn(
                "h-7 text-[10px] px-2 border-border/50 gap-1",
                isSelectedForCompare && "bg-amber-500/10 text-amber-500 hover:bg-amber-500/15 border-amber-500/30"
              )}
            >
              <ArrowRightLeft className="w-3 h-3" />
              {isSelectedForCompare ? "Selected" : "Compare"}
            </Button>

            {/* Pin Toggle Button */}
            <Button 
              size="icon" 
              variant="ghost"
              data-testid={`snapshot-pin-toggle-${snapshot.id}`}
              onClick={() => onTogglePin(snapshot.id, !snapshot.is_pinned)}
              disabled={isPinPending}
              className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg border border-border/50 hover:bg-primary/5"
            >
              <Pin className={cn("w-3.5 h-3.5", snapshot.is_pinned && "fill-current text-primary")} />
            </Button>
          </div>
        </div>

        {/* Chunks/Files count metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10.5px] text-muted-foreground bg-[#0F0F13]/40 p-2.5 rounded-lg border border-border/10 font-mono">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <span>{new Date(snapshot.indexed_at).toLocaleDateString()}</span>
          </div>
          <div>Files: <span className="text-foreground font-bold">{snapshot.files_count}</span></div>
          <div>Chunks: <span className="text-foreground font-bold">{snapshot.chunks_count}</span></div>
          {snapshot.files_skipped > 0 && (
            <div className="text-amber-500">Skipped: <span className="font-bold">{snapshot.files_skipped}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
