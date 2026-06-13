import React from "react";
import type { ChatMode } from "@/features/chat/types/chat-types";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";

interface RepositoryContextHeaderProps {
  repositoryId?: string;
  scopePaths?: string[];
  mode?: ChatMode;
  sessionTitle?: string;
}

export function RepositoryContextHeader({
  repositoryId,
  sessionTitle,
}: RepositoryContextHeaderProps) {
  const { repositories, isLoading } = useRepositories(100, 0);
  const repository = repositories.find(r => r.id === repositoryId);

  if (!repositoryId) return null;

  return (
    <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-4 py-2 shrink-0 backdrop-blur-xl sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/20 p-1.5 rounded-lg flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 20H2L12 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 10L17 18H7L12 10Z" fill="#8b5cf6" opacity="0.3"/>
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            {isLoading ? "Loading..." : repository?.repo_id?.split('/').pop() || "Repository"}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-foreground truncate">
              {sessionTitle || "New conversation"}
            </span>
            <span className="text-[10px] text-[#5CD4C2] font-semibold bg-[#5CD4C2]/10 px-1.5 py-0.5 rounded uppercase shrink-0">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
