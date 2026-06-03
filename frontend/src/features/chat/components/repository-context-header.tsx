import React from "react";
import { FolderGit2, FolderTree, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChatMode } from "@/features/chat/types/chat-types";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";

interface RepositoryContextHeaderProps {
  repositoryId?: string;
  scopePaths?: string[];
  mode: ChatMode;
}

export function RepositoryContextHeader({
  repositoryId,
  scopePaths = [],
  mode,
}: RepositoryContextHeaderProps) {
  const { repositories, isLoading } = useRepositories(100, 0);
  const repository = repositories.find(r => r.id === repositoryId);

  if (!repositoryId) return null;

  return (
    <div className="flex items-center gap-4 border-b border-border/40 bg-card/30 px-4 py-2 shrink-0 backdrop-blur-sm sticky top-0 z-10 text-xs">
      {/* Active Repository */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FolderGit2 className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate">
          {isLoading ? "Loading..." : repository?.repo_id || "Unknown Repository"}
        </span>
      </div>

      {/* Active Scopes */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground truncate">
          {scopePaths.length > 0 ? scopePaths.join(", ") : "All files"}
        </span>
      </div>

      {/* Current Mode */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={mode === "ACT" ? "destructive" : mode === "PLAN" ? "default" : "secondary"} className="text-[10px] uppercase font-bold py-0 h-5">
          <Zap className="h-3 w-3 mr-1" />
          {mode} MODE
        </Badge>
      </div>
    </div>
  );
}
