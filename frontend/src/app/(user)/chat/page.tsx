'use client';

import * as React from 'react';
import { Clock3, Plus } from 'lucide-react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { useRepositories } from '@/features/repositories/hooks/use-repositories';
import { useChatSessions } from '@/features/chat/hooks/use-chat';

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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Unified Workspace Canvas */}
      <div className="min-h-0 flex-1 relative">
        {repositories.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-card/10">
            <div className="rounded-full bg-primary/10 p-4 mb-4 shadow-glow-sm">
              <Plus className="h-6 w-6 text-primary/60" />
            </div>
            <h3 className="font-semibold text-foreground">No repositories available</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              You need to add and index a repository before you can chat with the AI about your code.
            </p>
          </div>
        ) : !ready ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-card/10">
            <div className="rounded-full bg-amber-500/10 p-4 mb-4 shadow-glow-sm">
              <Clock3 className="h-6 w-6 text-amber-600 dark:text-amber-400 animate-spin" />
            </div>
            <h3 className="font-semibold text-foreground">Repository indexing in progress</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Please wait for the repository to finish indexing before you can chat about it.
            </p>
          </div>
        ) : (
          <ChatWorkspace 
            repositoryId={selectedRepositoryId || undefined}
            repositories={repositories}
            onRepositoryChange={setSelectedRepositoryId}
            isRepositoriesLoading={reposLoading}
          />
        )}
      </div>
    </div>
  );
}