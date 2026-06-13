'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  useRepositories,
  useIndexRepository,
  useIndexingJobs,
  useRepositoryInsights,
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
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { DASHBOARD_TABLE_CELL, DASHBOARD_TABLE_HEAD } from '@/components/layout/nav-tokens';
import { isRepositoryIndexed } from '@/features/dashboard/utils/repo-index-status';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

const REPO_TABLE_GRID =
  'lg:grid lg:grid-cols-[minmax(280px,3fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(88px,0.7fr)_minmax(88px,0.7fr)_minmax(160px,1.2fr)_minmax(200px,1.3fr)]';
const REPO_ROW_MOBILE = 'max-lg:flex max-lg:flex-col max-lg:gap-3';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/features/studio/panels/background-tasks-panel';

/* ── Status configuration ──────────────────────────────── */

const STATUS_MAP: Record<
  string,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  completed: {
    label: 'READY',
    colorClass: 'text-success',
    icon: <CheckCircle2 className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  running: {
    label: 'INDEXING',
    colorClass: 'text-warning',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin xl:h-4 xl:w-4" />,
  },
  in_progress: {
    label: 'INDEXING',
    colorClass: 'text-warning',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin xl:h-4 xl:w-4" />,
  },
  pending: {
    label: 'PENDING',
    colorClass: 'text-muted-foreground',
    icon: <Clock className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  queued: {
    label: 'QUEUED',
    colorClass: 'text-muted-foreground',
    icon: <Clock className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
  failed: {
    label: 'FAILED',
    colorClass: 'text-error',
    icon: <XCircle className="h-3.5 w-3.5 xl:h-4 xl:w-4" />,
  },
};

function getStatus(status?: string | null) {
  const key = (status ?? '').toLowerCase();
  return (
    STATUS_MAP[key] ?? {
      label: 'NEW',
      colorClass: 'text-muted-foreground/60',
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

  const handleReindex = (repo: (typeof repositories)[number], fullReindex = true) => {
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
    <div className="w-full rounded-3xl border border-border/60 bg-card/60 shadow-premium backdrop-blur-xl">
      {/* Desktop header row */}
      <div className={cn('hidden lg:grid gap-4 border-b border-border/40 bg-background/40 px-6 py-4 xl:px-8 xl:py-5', REPO_TABLE_GRID)}>
        <span className={DASHBOARD_TABLE_HEAD}>Repository</span>
        <span className={DASHBOARD_TABLE_HEAD}>Status</span>
        <span className={DASHBOARD_TABLE_HEAD}>Commit</span>
        <span className={cn(DASHBOARD_TABLE_HEAD, 'text-right')}>Files</span>
        <span className={cn(DASHBOARD_TABLE_HEAD, 'text-right')}>Chunks</span>
        <span className={DASHBOARD_TABLE_HEAD}>Last Indexed</span>
        <span className={cn(DASHBOARD_TABLE_HEAD, 'text-right')}>Actions</span>
      </div>

      {/* Repository rows */}
      {repos.map((repo, i) => {
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
          summary?.indexed_chunks_count ??
          (repo.latest_indexed_chunks ||
            (repo.latest_job_stats?.indexed_chunks as number) ||
            (repo.latest_job_stats?.stored_chunks as number) ||
            0);
        const commitSha = summary?.last_commit_sha;
        const failedMessage = summary?.latest_job_message;
        const isNew = !repo.latest_job_status;
        const statusCfg = getStatus(effectiveJobStatus);
        const isPrimary = repo.id === primaryRepoId;
        const canOpenCodebase = isRepositoryIndexed({
          latest_job_status: repo.latest_job_status,
          indexed_chunks_count: chunksCount,
        });

        return (
          <div key={repo.id} className={cn(i !== 0 && 'border-t border-border/40')}>
            <div
              className={cn(
                'group items-center gap-4 px-6 py-5 transition-all duration-200 xl:px-8 xl:py-6',
                REPO_ROW_MOBILE,
                REPO_TABLE_GRID,
                'hover:bg-primary/[0.03]',
              )}
            >
              {/* Repo name & branch */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/60 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.35)] xl:h-12 xl:w-12">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary xl:h-6 xl:w-6" />
                </div>
                <div className="min-w-0">
                  <h4
                    title={repo.repo_id}
                    className="break-all text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:break-normal xl:text-lg"
                  >
                    {repo.repo_id}
                  </h4>
                  <div className="mt-1 flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 text-muted-foreground xl:h-3.5 xl:w-3.5" />
                    <span className="text-sm text-muted-foreground xl:text-base">
                      {repo.default_branch}
                      {isPrimary && topLanguage ? ` · ${topLanguage}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <div
                  className={cn('flex items-center gap-1.5', statusCfg.colorClass)}
                  title={statusCfg.label === 'FAILED' && failedMessage ? failedMessage : undefined}
                >
                  {statusCfg.icon}
                  <span className="text-sm font-bold uppercase tracking-[0.15em] xl:text-base">
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Commit */}
              <div className="hidden lg:block">
                <span className="font-mono text-sm text-muted-foreground xl:text-base">
                  {commitSha ? commitSha.slice(0, 8) : '—'}
                </span>
              </div>

              {/* Files */}
              <div className="text-right">
                <span className={cn(DASHBOARD_TABLE_CELL, 'font-mono tabular-nums')}>
                  {filesCount.toLocaleString()}
                </span>
                <span className="ml-1 text-sm text-muted-foreground md:hidden">
                  files
                </span>
              </div>

              {/* Chunks */}
              <div className="text-right">
                <span className={cn(DASHBOARD_TABLE_CELL, 'font-mono tabular-nums')}>
                  {chunksCount.toLocaleString()}
                </span>
                <span className="ml-1 text-sm text-muted-foreground md:hidden">
                  chunks
                </span>
              </div>

              {/* Last Indexed */}
              <div>
                <span className="text-sm text-muted-foreground xl:text-base">
                  {summary?.last_indexed_at
                    ? formatDate(summary.last_indexed_at)
                    : repo.updated_at
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
                      variant="outline"
                      onClick={() => handleReindex(repo)}
                      disabled={indexing || indexMutation.isPending}
                      className="h-9 gap-1.5 px-4 text-sm xl:h-10 xl:px-5 xl:text-base"
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5 xl:h-4 xl:w-4', indexing && 'animate-spin')}
                      />
                      Re-index
                    </Button>
                    {canOpenCodebase ? (
                      <button
                        type="button"
                        onClick={() => handleOpenCodebase(repo.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-primary/20 hover:bg-primary/10 hover:text-primary xl:h-10 xl:w-10"
                        title="Open codebase"
                      >
                        <ArrowUpRight className="h-4 w-4 xl:h-5 xl:w-5" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            
            {/* Expanded active task card — show whenever we have an active job */}
            {activeJob ? (
              <div className="border-t border-border/30 bg-muted/10 px-4 py-4 sm:px-6 sm:py-5 xl:px-8">
                <ActiveTaskCard jobId={String(activeJob.id)} fallbackJob={activeJob} />
              </div>
            ) : indexing ? (
              <div className="border-t border-border/30 bg-muted/10 px-4 py-4 sm:px-6 sm:py-5 xl:px-8">
                <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
