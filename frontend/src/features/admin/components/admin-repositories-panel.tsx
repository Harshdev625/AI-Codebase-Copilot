'use client';

import { AlertTriangle, Clock, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import type { IndexingJob } from '@/features/admin/services/admin-service';
import type { Repository } from '@/features/repositories/types/repository-types';

interface AdminRepositoriesPanelProps {
  repositories: Repository[];
  indexingJobs: IndexingJob[];
  isLoadingRepos?: boolean;
  isLoadingJobs?: boolean;
  onReindex: (repoId: string) => void;
  isReindexing?: boolean;
}

export function AdminRepositoriesPanel({
  repositories,
  indexingJobs,
  isLoadingRepos,
  isLoadingJobs,
  onReindex,
  isReindexing,
}: AdminRepositoriesPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col rounded-2xl border border-border/40 bg-card/60 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground lg:text-base xl:text-lg">Repository Operations</h2>
        </div>
        {isLoadingRepos ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-3">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="group flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{repo.repo_id}</p>
                  <p className="text-xs text-muted-foreground">{repo.default_branch}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge
                    variant={
                      repo.latest_job_status === 'completed'
                        ? 'success'
                        : repo.latest_job_status === 'failed'
                          ? 'error'
                          : repo.latest_job_status
                            ? 'warning'
                            : 'muted'
                    }
                    className="text-xs"
                  >
                    {repo.latest_job_status || 'idle'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-border/40 bg-transparent text-xs text-foreground hover:bg-muted"
                    onClick={() => onReindex(repo.id)}
                    disabled={isReindexing}
                  >
                    Reindex
                  </Button>
                </div>
              </div>
            ))}
            {repositories.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/40 py-8 text-center text-sm text-muted-foreground">
                No repositories indexed yet.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col rounded-2xl border border-border/40 bg-card/60 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground lg:text-base xl:text-lg">Indexing Job History</h2>
        </div>
        {isLoadingJobs ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="custom-scrollbar max-h-[600px] space-y-3 overflow-y-auto pr-2">
            {indexingJobs.map((job) => {
              const repoName =
                repositories.find((r) => r.id === job.repository_id)?.repo_id || job.repository_id;
              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground xl:text-sm">
                          ID: {job.id.substring(0, 8)}
                        </span>
                        {job.status === 'failed' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </div>
                      <p className="truncate text-sm font-medium text-foreground">{repoName}</p>
                    </div>
                    <Badge
                      variant={
                        job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'
                      }
                      className="ml-2 shrink-0 text-xs"
                    >
                      {job.status}
                    </Badge>
                  </div>
                  {(job.message || job.status === 'failed') && (
                    <div className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/20 bg-background/50 p-2.5 font-mono text-xs text-muted-foreground">
                      {job.message || 'Job execution failed unexpectedly.'}
                    </div>
                  )}
                  <div className="mt-1 text-right text-xs font-medium text-muted-foreground xl:text-sm">
                    {formatDate(job.created_at)}
                  </div>
                </div>
              );
            })}
            {indexingJobs.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/40 py-8 text-sm text-muted-foreground">
                No recent indexing jobs.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
