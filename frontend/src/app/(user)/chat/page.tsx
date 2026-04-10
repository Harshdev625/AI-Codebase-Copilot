'use client';

import * as React from 'react';
import { BrainCircuit } from 'lucide-react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { ChatContextSidebar } from '@/features/chat/components/chat-context-sidebar';
import { useProjects, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { Badge } from '@/components/ui/badge';

export default function ChatPage() {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [selectedRepositoryId, setSelectedRepositoryId] = React.useState<string>('');

  const { repositories, isLoading } = useRepositories(selectedProjectId);

  // Auto-select first project
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Auto-select first indexed repository
  React.useEffect(() => {
    if (!selectedRepositoryId && repositories.length > 0) {
      const indexed = repositories.find((r) => r.latest_index_status?.toLowerCase() === 'completed');
      setSelectedRepositoryId(indexed?.id ?? repositories[0].id);
    }
  }, [repositories, selectedRepositoryId]);

  return (
    <div className="flex h-[calc(100vh-56px)] w-full overflow-hidden">
      {/* Top header bar */}
      <div className="absolute top-14 left-0 right-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/60 backdrop-blur-md px-6 py-2.5 pointer-events-none">
        <div>
          <h1 className="text-base font-bold tracking-tight">AI Workspace</h1>
          <p className="text-[11px] text-muted-foreground/60">
            Context-aware assistant · Agentic RAG · LangGraph
          </p>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <Badge variant="ai" className="gap-1.5">
            <BrainCircuit className="h-3 w-3" />
            GPT-4 Turbo
          </Badge>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/20 text-[10px] font-bold uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Real-time RAG
          </div>
        </div>
      </div>

      {/* Main chat layout (push down by header 40px = py-2.5 * 2 + text) */}
      <div className="flex flex-1 overflow-hidden mt-[49px]">
        <div className="flex flex-1 overflow-hidden">
          <ChatWorkspace repositoryId={selectedRepositoryId} />
        </div>
        <div className="border-l border-border/30 p-4 overflow-y-auto">
          <ChatContextSidebar
            repositories={repositories}
            selectedId={selectedRepositoryId}
            onSelect={setSelectedRepositoryId}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
