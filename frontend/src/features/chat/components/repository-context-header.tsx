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
    <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-6 py-3 shrink-0 backdrop-blur-xl sticky top-0 z-10">
      {/* Left Area: Context & Session Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/20 p-1.5 rounded-lg flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 20H2L12 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 10L17 18H7L12 10Z" fill="#8b5cf6" opacity="0.3"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            {isLoading ? "Loading..." : repository?.repo_id?.split('/').pop() || "Adept-Platform"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              {sessionTitle || "Refactor User Auth Flow"}
            </span>
            <span className="text-[10px] text-[#5CD4C2] font-semibold bg-[#5CD4C2]/10 px-1.5 py-0.5 rounded uppercase">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Right Area: Action Icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
        </button>
        <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        </button>
        <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
        </button>
        <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </button>
      </div>
    </div>
  );
}
