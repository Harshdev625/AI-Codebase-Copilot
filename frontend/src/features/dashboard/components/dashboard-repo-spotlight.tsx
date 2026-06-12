'use client';

import { useRouter } from 'next/navigation';
import { GitBranch, FolderGit2, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import type { DashboardRecentRepository } from '@/features/dashboard/types/dashboard-types';

interface DashboardRepoSpotlightProps {
  repository?: DashboardRecentRepository | null;
}

export function DashboardRepoSpotlight({ repository }: DashboardRepoSpotlightProps) {
  const router = useRouter();
  const indexMutation = useIndexRepository();

  if (!repository) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
        <FolderGit2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">No repository spotlight</p>
        <p className="mt-1 text-xs text-muted-foreground/80">Add a repository to see health details here.</p>
      </div>
    );
  }

  const status = (repository.latest_job_status ?? repository.latest_index_status ?? 'idle').toLowerCase();
  const isIndexing = ['running', 'in_progress', 'pending', 'queued'].includes(status);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-border/60 bg-card/60 p-6 shadow-premium backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Primary repository</p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground lg:text-lg">{repository.repo_id}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {repository.default_branch}
          </div>
        </div>
        <Badge variant={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning'}>
          {status}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Files</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {(repository.indexed_files_count ?? 0).toLocaleString()}
          </dd>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Chunks</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {(repository.indexed_chunks_count ?? 0).toLocaleString()}
          </dd>
        </div>
      </dl>

      {repository.last_commit_sha && (
        <p className="mt-3 truncate font-mono text-xs text-muted-foreground" title={repository.last_commit_sha}>
          Last commit: {repository.last_commit_sha.slice(0, 12)}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Last indexed:{' '}
        {repository.last_indexed_at ? formatDate(repository.last_indexed_at) : 'Never'}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={isIndexing || indexMutation.isPending}
          onClick={() => indexMutation.mutate({ repository_id: repository.id })}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isIndexing ? 'animate-spin' : ''}`} />
          Re-index
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => router.push(`/studio?repository_id=${repository.id}`)}
        >
          Open codebase
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
