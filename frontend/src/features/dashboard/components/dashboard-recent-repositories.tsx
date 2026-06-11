'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  useRepositories,
  useIndexRepository,
  useIndexingJobs,
} from '@/features/repositories/hooks/use-repositories';
import { repositoryService } from '@/features/repositories/services/repository-service';
import { isStudioEnabled } from '@/lib/feature-flags';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  FolderGit2,
  ArrowUpRight,
  RefreshCw,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/features/workspace/components/background-tasks-panel';

/* ── Status configuration ──────────────────────────────── */

const STATUS_MAP: Record<
  string,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  completed: {
    label: 'READY',
    colorClass: 'text-success',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  running: {
    label: 'INDEXING',
    colorClass: 'text-warning',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  in_progress: {
    label: 'INDEXING',
    colorClass: 'text-warning',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  pending: {
    label: 'PENDING',
    colorClass: 'text-muted-foreground',
    icon: <Clock className="h-3 w-3" />,
  },
  queued: {
    label: 'QUEUED',
    colorClass: 'text-muted-foreground',
    icon: <Clock className="h-3 w-3 animate-pulse" />,
  },
  failed: {
    label: 'FAILED',
    colorClass: 'text-error',
    icon: <XCircle className="h-3 w-3" />,
  },
};

function getStatus(status?: string | null) {
  const key = (status ?? '').toLowerCase();
  return (
    STATUS_MAP[key] ?? {
      label: 'NEW',
      colorClass: 'text-muted-foreground/60',
      icon: <Clock className="h-3 w-3" />,
    }
  );
}

function isIndexingStatus(status?: string | null): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'running' || s === 'in_progress' || s === 'queued' || s === 'pending';
}

/* ── Active Task Card with Live Polling ───────────────── */

function ActiveTaskCard({ jobId, fallbackJob }: { jobId: string, fallbackJob: any }) {
  const { data } = useQuery({
    queryKey: ['index-progress', jobId],
    queryFn: () => repositoryService.getIndexProgress(jobId),
    refetchInterval: (query) => {
      const s = query.state.data?.job_status;
      if (!s) return 2000;
      return ['running', 'in_progress', 'queued', 'pending'].includes(s)
        ? 2000
        : false;
    },
  });

  // Merge the rich polled data with the fallback job structure TaskCard expects
  const jobProps = React.useMemo(() => {
    if (!data) return fallbackJob;
    return {
      ...fallbackJob,
      status: data.job_status || fallbackJob.status,
      message: data.message || fallbackJob.message,
      stats: {
        ...fallbackJob.stats,
        ...data.stats,
        percentage: data.percentage ?? fallbackJob.stats?.percentage ?? 0,
        current_stage: data.stats?.current_stage ?? fallbackJob.stats?.current_stage ?? 'queued',
        eta_seconds: data.eta_seconds ?? fallbackJob.stats?.eta_seconds,
        processed_files: data.processed_files ?? fallbackJob.stats?.processed_files,
        total_files: data.total_files ?? fallbackJob.stats?.total_files,
        current_file: data.current_file ?? fallbackJob.stats?.current_file,
      }
    };
  }, [data, fallbackJob]);

  return <TaskCard job={jobProps} />;
}

/* ── Main component ────────────────────────────────────── */

export function DashboardRecentRepositories() {
  const { repositories, isLoading } = useRepositories(100, 0);
  const router = useRouter();
  const indexMutation = useIndexRepository();

  // Get all indexing jobs to map repo → active job for progress polling
  const { data: allJobs } = useIndexingJobs();
  const activeJobByRepo = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const job of allJobs ?? []) {
      if (
        ['running', 'in_progress', 'queued', 'pending'].includes(job.status)
      ) {
        if (!map.has(job.repository_id)) {
          map.set(job.repository_id, job);
        }
      }
    }
    return map;
  }, [allJobs]);

  /* ── Handlers ──────────────────────────────────────────── */

  const handleReindex = (repo: (typeof repositories)[number]) => {
    indexMutation.mutate({
      repository_id: repo.id,
      repo_url: repo.remote_url,
      repo_path: repo.local_path,
      repo_ref: repo.default_branch,
    });
  };

  const handleOpenWorkspace = (repoId: string) => {
    const targetPath = isStudioEnabled() ? `/studio?repository_id=${repoId}` : `/workspace?repository_id=${repoId}`;
    router.push(targetPath);
  };

  /* ── Loading state ─────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl bg-card/60" />
        ))}
      </div>
    );
  }

  const repos = repositories ?? [];

  /* ── Empty state ───────────────────────────────────────── */

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-5 rounded-3xl border border-dashed border-border/60 bg-card/40">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl rounded-full bg-primary/15 animate-glow-pulse" />
          <div className="relative h-14 w-14 rounded-2xl bg-background/60 border border-border/60 flex items-center justify-center">
            <FolderGit2 className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            No repositories yet
          </p>
          <p className="text-xs text-muted-foreground">
            Add your first repository to start indexing and exploring your
            codebase.
          </p>
        </div>
      </div>
    );
  }

  /* ── Repository list ───────────────────────────────────── */

  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-premium animate-fade-up">
      {/* Desktop header row */}
      <div className="hidden md:grid grid-cols-[1fr_140px_72px_72px_120px_160px] gap-3 px-5 py-3 border-b border-border/40 bg-background/40">
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Repository
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Status
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground text-right">
          Files
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground text-right">
          Chunks
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Last Indexed
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground text-right">
          Actions
        </span>
      </div>

      {/* Repository rows */}
      {repos.map((repo, i) => {
        const indexing = isIndexingStatus(repo.latest_job_status);
        const activeJob = activeJobByRepo.get(repo.id) ?? null;
        const filesCount =
          (repo.latest_job_stats?.total_files as number) ||
          (repo.latest_index_stats?.total_files as number) ||
          0;
        const chunksCount =
          repo.latest_indexed_chunks ||
          (repo.latest_job_stats?.indexed_chunks as number) ||
          (repo.latest_job_stats?.stored_chunks as number) ||
          0;
        
        const isNew = !repo.latest_job_status;
        const statusCfg = getStatus(repo.latest_job_status);

        return (
          <div key={repo.id} className={cn(i !== 0 && 'border-t border-border/40')}>
            <div
              className={cn(
                'group grid grid-cols-1 md:grid-cols-[1fr_140px_72px_72px_120px_160px] gap-3 items-center px-5 py-4 transition-all duration-200',
                'hover:bg-primary/[0.03]',
              )}
            >
              {/* Repo name & branch */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/60 border border-border/60 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.35)]">
                  <FolderGit2 className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                    {repo.repo_id}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <GitBranch className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {repo.default_branch}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <div className={cn('flex items-center gap-1.5', statusCfg.colorClass)}>
                  {statusCfg.icon}
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Files */}
              <div className="text-right">
                <span className="text-[12px] font-mono tabular-nums text-foreground">
                  {filesCount.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1 md:hidden">
                  files
                </span>
              </div>

              {/* Chunks */}
              <div className="text-right">
                <span className="text-[12px] font-mono tabular-nums text-foreground">
                  {chunksCount.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1 md:hidden">
                  chunks
                </span>
              </div>

              {/* Last Indexed */}
              <div>
                <span className="text-[10px] text-muted-foreground">
                  {repo.updated_at
                    ? formatDate(repo.updated_at)
                    : repo.created_at
                      ? formatDate(repo.created_at)
                      : '—'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                {isNew ? (
                  <Button 
                    size="sm" 
                    onClick={() => handleReindex(repo)}
                    disabled={indexMutation.isPending}
                    className="h-7 text-[11px] gap-1.5 px-3"
                  >
                    {indexMutation.isPending && !indexing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Start Indexing
                  </Button>
                ) : (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleReindex(repo)}
                      disabled={indexing || indexMutation.isPending}
                      className="h-7 text-[11px] gap-1.5 px-3"
                    >
                      <RefreshCw
                        className={cn('h-3 w-3', indexing && 'animate-spin')}
                      />
                      Re-index
                    </Button>
                    <button
                      onClick={() => handleOpenWorkspace(repo.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all shrink-0"
                      title="Open Workspace"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Expanded active task card */}
            {indexing && activeJob && (
              <div className="px-5 pb-4 bg-background/20">
                <div className="w-full xl:w-[85%]">
                  <ActiveTaskCard jobId={activeJob.id} fallbackJob={activeJob} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
