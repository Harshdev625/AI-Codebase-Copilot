'use client';

import * as React from 'react';
import { CheckCircle2, ChevronDown, Clock3, MessageSquare, Loader2, AlertCircle, Plus } from 'lucide-react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { ChatSidebar } from '@/components/layout/chat-sidebar';
import { useRepositories } from '@/features/repositories/hooks/use-repositories';
import { useChatSessions } from '@/features/chat/hooks/use-chat';
import type { Repository } from '@/features/repositories/types/repository-types';
import { cn } from '@/lib/utils';

function RepoPicker({
  repositories,
  selectedId,
  onSelect,
  isLoading,
}: {
  repositories: Repository[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = repositories.find((repo) => repo.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isLoading || repositories.length === 0}
        className={cn(
          'flex min-w-[260px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
          'bg-background text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className="truncate">{selected?.repo_id || (isLoading ? 'Loading repositories...' : 'Select repository')}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {repositories.map((repo) => {
            const status = (repo.latest_job_status || repo.latest_index_status || '').toLowerCase();
            const ready = status === 'completed';
            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => {
                  onSelect(repo.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  repo.id === selectedId ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-accent'
                )}
              >
                {ready ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Clock3 className="h-4 w-4 text-amber-500" />
                )}
                <span className="truncate">{repo.repo_id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { repositories, isLoading: reposLoading } = useRepositories(100, 0);
  const { data: sessionsData, isLoading: sessionsLoading } = useChatSessions();
  const [selectedRepositoryId, setSelectedRepositoryId] = React.useState('');
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>();

  const sessions = React.useMemo(
    () => (sessionsData?.pagination ? sessionsData.items : []),
    [sessionsData]
  );

  React.useEffect(() => {
    if (selectedRepositoryId || repositories.length === 0) {
      return;
    }
    const indexed = repositories.find((repo) => {
      const status = (repo.latest_job_status || repo.latest_index_status || '').toLowerCase();
      return status === 'completed';
    });
    setSelectedRepositoryId(indexed?.id || repositories[0].id);
  }, [repositories, selectedRepositoryId]);

  const selectedRepo = repositories.find((repo) => repo.id === selectedRepositoryId);
  const selectedStatus = (selectedRepo?.latest_job_status || selectedRepo?.latest_index_status || 'not_indexed').toLowerCase();
  const ready = selectedStatus === 'completed';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Chat Sidebar */}
      <ChatSidebar
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onNewSession={() => setSelectedSessionId(undefined)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            Repository Chat
          </div>

          {/* Repository selector */}
          <div className="flex-1 min-w-0">
            {reposLoading ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/40 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading repositories...</span>
              </div>
            ) : repositories.length === 0 ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm text-amber-600 dark:text-amber-400">Add a repository to start chatting</span>
              </div>
            ) : (
              <RepoPicker
                repositories={repositories}
                selectedId={selectedRepositoryId}
                onSelect={setSelectedRepositoryId}
                isLoading={reposLoading}
              />
            )}
          </div>

          {/* Repository status badge */}
          {selectedRepo && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
                ready ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'
              )}
            >
              {ready ? 'Indexed' : selectedStatus.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Chat Workspace */}
        <div className="min-h-0 flex-1">
          {repositories.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Plus className="h-6 w-6 text-primary/60" />
              </div>
              <h3 className="font-semibold text-foreground">No repositories available</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                You need to add and index a repository before you can chat with the AI about your code.
              </p>
            </div>
          ) : !ready ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-amber-500/10 p-4 mb-4">
                <Clock3 className="h-6 w-6 text-amber-600 dark:text-amber-400 animate-spin" />
              </div>
              <h3 className="font-semibold text-foreground">Repository indexing in progress</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Please wait for the repository to finish indexing before you can chat about it.
              </p>
            </div>
          ) : (
            <ChatWorkspace mode="repository" repositoryId={selectedRepositoryId || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}