import React from "react";
import type { ChatMode } from "@/features/chat/types/chat-types";
import { formatSessionTimestamp } from "@/features/chat/utils/chat-timestamp-utils";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";

interface RepositoryContextHeaderProps {
  repositoryId?: string;
  scopePaths?: string[];
  mode?: ChatMode;
  sessionTitle?: string;
  sessionTimestamp?: string;
}

export function RepositoryContextHeader({
  repositoryId,
  sessionTitle,
  sessionTimestamp,
}: RepositoryContextHeaderProps) {
  const { repositories, isLoading } = useRepositories(100, 0);
  const repository = repositories.find((r) => r.id === repositoryId);

  if (!repositoryId) return null;

  const formatted = formatSessionTimestamp(sessionTimestamp);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-card/60 px-4 py-2 backdrop-blur-xl sticky top-0 z-10">
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
            <span className="shrink-0 rounded bg-[#5CD4C2]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#5CD4C2]">
              Active
            </span>
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
