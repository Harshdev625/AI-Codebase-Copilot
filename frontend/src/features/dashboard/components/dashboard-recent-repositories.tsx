'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  useRepositories,
  useIndexRepository,
  useIndexingJobs,
  useRepositoryInsights,
  useDeleteRepository,
} from '@/features/repositories/hooks/use-repositories';
import type { DashboardRecentRepository } from '@/features/dashboard/types/dashboard-types';
import { useIndexJobProgress } from '@/features/dashboard/hooks/use-index-job-progress';
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
  Trash2,
  Activity,
  Database,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { DASHBOARD_TABLE_CELL, DASHBOARD_TABLE_HEAD } from '@/components/layout/nav-tokens';
import { isRepositoryIndexed } from '@/features/dashboard/utils/repo-index-status';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

// No table grid classes needed for the list layout
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/features/studio/panels/background-tasks-panel';

function ScanningIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <Database className="h-full w-full opacity-20" />
      <div className="absolute inset-0 animate-pulse text-current">
        <Database className="h-full w-full" />
      </div>
    </div>
  );
}

/* ── Status configuration ──────────────────────────────── */

const STATUS_MAP: Record<
  string,
  { label: string; colorClass: string; bgClass: string; icon: React.ReactNode }
> = {
  completed: {
    label: 'READY',
    colorClass: 'text-success dark:text-success',
    bgClass: 'bg-success/15 dark:bg-success/10',
    icon: <CheckCircle2 className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  running: {
    label: 'INDEXING',
    colorClass: 'text-warning dark:text-warning',
    bgClass: 'bg-warning/15 dark:bg-warning/10',
    icon: <ScanningIcon className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  in_progress: {
    label: 'INDEXING',
    colorClass: 'text-warning dark:text-warning',
    bgClass: 'bg-warning/15 dark:bg-warning/10',
    icon: <ScanningIcon className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  pending: {
    label: 'PENDING',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30 dark:bg-muted/20',
    icon: <Clock className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  queued: {
    label: 'QUEUED',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30 dark:bg-muted/20',
    icon: <Clock className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  failed: {
    label: 'FAILED',
    colorClass: 'text-error dark:text-error',
    bgClass: 'bg-error/15 dark:bg-error/10',
    icon: <XCircle className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
};

function getStatus(status?: string | null) {
  const key = (status ?? '').toLowerCase();
  return (
    STATUS_MAP[key] ?? {
      label: 'NEW',
      colorClass: 'text-muted-foreground/80',
      bgClass: 'bg-muted/20',
      icon: <Clock className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
    }
  );
}

function isIndexingStatus(status?: string | null): boolean {
  return isActiveIndexingStatus(status);
}

/* ── Active Task Card with Live Polling ───────────────── */

function ActiveTaskCard({ jobId, fallbackJob }: { jobId: string; fallbackJob: Record<string, unknown> }) {
  const { job, isInitialLoad } = useIndexJobProgress(jobId, fallbackJob);

  if (isInitialLoad) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading progress…
      </div>
    );
  }

  return <TaskCard job={job} embedded />;
}

/* ── Main component ────────────────────────────────────── */

interface DashboardRecentRepositoriesProps {
  summaryRepos?: DashboardRecentRepository[];
}

export function DashboardRecentRepositories({ summaryRepos }: DashboardRecentRepositoriesProps) {
  const { repositories, isLoading } = useRepositories(100, 0);
  const router = useRouter();
  const indexMutation = useIndexRepository();
  const deleteMutation = useDeleteRepository();

  const enrichedById = React.useMemo(() => {
    const map = new Map<string, DashboardRecentRepository>();
    for (const r of summaryRepos ?? []) {
      map.set(r.id, r);
    }
    return map;
  }, [summaryRepos]);

  const primaryRepoId = repositories?.[0]?.id ?? summaryRepos?.[0]?.id ?? '';
  const { data: primaryInsights } = useRepositoryInsights(primaryRepoId);
  const topLanguage = React.useMemo(() => {
    const breakdown = primaryInsights?.language_breakdown as Record<string, number> | undefined;
    if (!breakdown) return null;
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  }, [primaryInsights]);

  // Get all indexing jobs to map repo → active job for progress polling
  const { data: allJobs } = useIndexingJobs();
  const activeJobByRepo = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const job of allJobs ?? []) {
      if (isActiveIndexingStatus(job.status)) {
        const repoId = String(job.repository_id);
        if (!map.has(repoId)) {
          map.set(repoId, job);
        }
      }
    }
    return map;
  }, [allJobs]);

  /* ── Handlers ──────────────────────────────────────────── */

  const handleReindex = (repo: (typeof repositories)[number], fullReindex = false) => {
    indexMutation.mutate({
      repository_id: repo.id,
      repo_url: repo.remote_url,
      repo_path: repo.local_path,
      repo_ref: repo.default_branch,
      full_reindex: fullReindex,
    });
  };

  const handleOpenCodebase = (repoId: string) => {
    router.push(`/studio?repository_id=${repoId}`);
  };

  const repos = repositories ?? [];

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

  /* ── Empty state ───────────────────────────────────────── */

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-5 rounded-3xl border border-dashed border-border/60 bg-card/40">
        <div className="h-14 w-14 rounded-2xl bg-background/60 border border-border/60 flex items-center justify-center">
          <FolderGit2 className="h-6 w-6 text-muted-foreground" />
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
    <div className="flex flex-col gap-4">
      {repos.map((repo) => {
        const summary = enrichedById.get(repo.id);
        const activeJob = activeJobByRepo.get(repo.id) ?? null;
        const effectiveJobStatus = activeJob?.status ?? repo.latest_job_status;
        const indexing = isIndexingStatus(effectiveJobStatus);
        const filesCount =
          summary?.indexed_files_count ??
          ((repo.latest_job_stats?.total_files as number) ||
            (repo.latest_index_stats?.total_files as number) ||
            0);
        const chunksCount =
          repo.latest_indexed_chunks ??
          summary?.indexed_chunks_count ??
          (repo.latest_job_stats?.indexed_chunks as number) ??
          (repo.latest_job_stats?.stored_chunks as number) ??
          0;
        const jobFailed = ['failed', 'error'].includes(String(effectiveJobStatus ?? '').toLowerCase());
        const failedMessage = jobFailed
          ? String(
              activeJob?.message ??
                summary?.latest_job_message ??
                (typeof repo.latest_job_stats?.message === 'string'
                  ? repo.latest_job_stats.message
                  : ''),
            ).trim() || 'Indexing failed. Check backend logs and ensure Ollama/Qdrant are running.'
          : undefined;
        const isNew = !repo.latest_job_status;
        const statusCfg = getStatus(effectiveJobStatus);
        const isPrimary = repo.id === primaryRepoId;
        const canOpenCodebase = isRepositoryIndexed({
          latest_job_status: repo.latest_job_status,
          indexed_chunks_count: chunksCount,
        });

        return (
          <div
            key={repo.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 dark:border-white/10 bg-card/60 dark:bg-[#161820] shadow-premium backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-md dark:hover:bg-[#1A1D24]"
          >
            {/* ── Main Card Content ───────────────────────────────── */}
            <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between xl:gap-8 xl:p-8">
              
              {/* Left: Identity */}
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/60 shadow-sm transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.35)] xl:h-14 xl:w-14">
                  <FolderGit2 className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary xl:h-7 xl:w-7" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h4
                    title={repo.repo_id}
                    className="truncate text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary xl:text-xl"
                  >
                    {repo.repo_id}
                  </h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground xl:text-base">
                      <GitBranch className="h-3.5 w-3.5" />
                      {repo.default_branch}
                    </span>
                    {isPrimary && topLanguage ? (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-sm font-medium text-muted-foreground xl:text-base">
                          {topLanguage}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Middle: Metadata */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-5 lg:flex-nowrap lg:justify-end">
                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </span>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
                      statusCfg.bgClass,
                      statusCfg.colorClass,
                    )}
                    title={statusCfg.label === 'FAILED' && failedMessage ? failedMessage : undefined}
                  >
                    {statusCfg.icon}
                    <span className="text-xs font-bold uppercase tracking-wider xl:text-sm">
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {/* Content Stats */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Content
                  </span>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold tabular-nums text-foreground xl:text-base">
                      {filesCount.toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs font-medium text-muted-foreground xl:text-sm">
                      files
                    </span>
                    <span className="mx-1.5 text-muted-foreground/40">·</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground xl:text-base">
                      {chunksCount.toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs font-medium text-muted-foreground xl:text-sm">
                      chunks
                    </span>
                  </div>
                </div>

                {/* Last Indexed */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Indexed
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-foreground xl:text-base">
                    {summary?.last_indexed_at
                      ? formatDate(summary.last_indexed_at)
                      : repo.updated_at
                        ? formatDate(repo.updated_at)
                        : repo.created_at
                          ? formatDate(repo.created_at)
                          : '—'}
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="mt-2 flex items-center justify-end gap-2 lg:ml-6 lg:mt-0">
                {isNew ? (
                  <Button
                    size="sm"
                    onClick={() => handleReindex(repo, false)}
                    disabled={indexMutation.isPending}
                    className="h-9 gap-1.5 px-4 text-sm xl:h-10 xl:px-5 xl:text-base"
                  >
                    {indexMutation.isPending && !indexing ? (
                      <Loader2 className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                    ) : (
                      <Play className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                    )}
                    Start Indexing
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReindex(repo)}
                      disabled={indexing || indexMutation.isPending}
                      className="h-9 gap-1.5 px-4 text-sm font-medium xl:h-10 xl:px-5 xl:text-base"
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5 xl:h-4 xl:w-4', indexing && 'animate-spin')}
                      />
                      Update Index
                    </Button>
                    {canOpenCodebase ? (
                      <button
                        type="button"
                        onClick={() => handleOpenCodebase(repo.id)}
                        className="group/btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary xl:h-10 xl:w-10"
                        title="Open codebase"
                      >
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 xl:h-5 xl:w-5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this repository?')) {
                          deleteMutation.mutate(repo.id);
                        }
                      }}
                      className="group/btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive xl:h-10 xl:w-10"
                      title="Delete repository"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 xl:h-5 xl:w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Active Task (Indexing) ──────────────────────────── */}
            {activeJob ? (
              <div className="border-t border-border/30 bg-muted/10 px-6 py-5 dark:bg-black/20 xl:px-8">
                <ActiveTaskCard jobId={String(activeJob.id)} fallbackJob={activeJob} />
              </div>
            ) : indexing ? (
              <div className="border-t border-border/30 bg-muted/10 px-6 py-5 dark:bg-black/20 xl:px-8">
                <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4 animate-pulse text-primary" />
                  Starting indexing…
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
