import React from "react";
import { PenTool, PlayCircle, Search } from "lucide-react";

import type { ChatMode } from "@/features/chat/types/chat-types";
import type { ChangeSetStatus } from "@/features/change-sets/types/change-set-types";
import {
  planStatusLabel,
  planStatusTone,
  PLAN_STATUS_STYLES,
} from "@/features/change-sets/utils/plan-workflow-ui";
import { formatSessionTimestamp } from "@/features/chat/utils/chat-timestamp-utils";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";
import { cn } from "@/lib/utils";

interface RepositoryContextHeaderProps {
  repositoryId?: string;
  scopePaths?: string[];
  mode?: ChatMode;
  planStatus?: ChangeSetStatus;
  planVersion?: number;
  sessionTitle?: string;
  sessionTimestamp?: string;
}

const MODE_META: Record<
  ChatMode,
  { label: string; icon: React.ElementType; className: string }
> = {
  ASK: { label: "Ask", icon: Search, className: "bg-blue-500/15 text-blue-300 ring-blue-500/25" },
  PLAN: { label: "Plan", icon: PenTool, className: "bg-violet-500/15 text-violet-300 ring-violet-500/25" },
  ACT: { label: "Act", icon: PlayCircle, className: "bg-amber-500/15 text-amber-300 ring-amber-500/25" },
};

export function RepositoryContextHeader({
  repositoryId,
  mode = "ASK",
  planStatus,
  planVersion,
  sessionTitle,
  sessionTimestamp,
}: RepositoryContextHeaderProps) {
  const { repositories, isLoading } = useRepositories(100, 0);
  const repository = repositories.find((r) => r.id === repositoryId);

  if (!repositoryId) return null;

  const formatted = formatSessionTimestamp(sessionTimestamp);
  const modeMeta = MODE_META[mode] ?? MODE_META.ASK;
  const ModeIcon = modeMeta.icon;
  const planTone = planStatus ? planStatusTone(planStatus) : null;
  const planStyles = planTone ? PLAN_STATUS_STYLES[planTone] : null;

  return (
    <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/40 bg-card/70 px-4 py-2 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 20H2L12 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 10L17 18H7L12 10Z" fill="#8b5cf6" opacity="0.3"/>
          </svg>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isLoading ? "Loading…" : repository?.repo_id?.split("/").pop() || "Repository"}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-bold text-foreground">
              {sessionTitle || "New conversation"}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ring-1 ring-inset",
                modeMeta.className,
              )}
            >
              <ModeIcon className="h-2.5 w-2.5" />
              {modeMeta.label}
            </span>
            {planStatus && planStyles && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset",
                  planStyles.badge,
                )}
              >
                Plan {planVersion ? `v${planVersion}` : ""} · {planStatusLabel(planStatus)}
              </span>
            )}
          </div>
        </div>
      </div>
      {formatted && (
        <span className="shrink-0 text-[10px] text-muted-foreground/70" title="Last activity">
          {formatted}
        </span>
      )}
    </div>
  );
}
