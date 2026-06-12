'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, MessageSquare, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { useRepositories } from '@/features/repositories/hooks/use-repositories';
import { DashboardMomentumChart } from './dashboard-momentum-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function RecentSessionsCard() {
  const router = useRouter();
  const { summary, isLoading } = useDashboard();
  const { repositories } = useRepositories(100, 0);
  const sessions = summary?.recent_sessions ?? [];

  const repoNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of summary?.recent_repositories ?? []) {
      map.set(r.id, r.repo_id);
    }
    for (const r of repositories ?? []) {
      map.set(r.id, r.repo_id);
    }
    return map;
  }, [summary?.recent_repositories, repositories]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-3xl" />;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-premium backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground lg:text-base">Recent Sessions</h3>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm">Continue interrogating your codebase</p>
        </div>
        <MessageSquare className="h-5 w-5 text-primary" />
      </div>
      {sessions.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">No chat sessions yet.</p>
          <Button size="sm" variant="outline" onClick={() => router.push('/studio')}>
            Open codebase
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/studio?session_id=${session.id}${session.repository_id ? `&repository_id=${session.repository_id}` : ''}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {session.session_title || 'Untitled session'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {session.session_mode}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {session.repository_id
                      ? repoNameById.get(session.repository_id) ?? 'Repository'
                      : 'No repository'}{' '}
                    ·{' '}
                    {session.updated_at
                      ? formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })
                      : 'Recently'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IndexingNowCard() {
  const { repositories } = useRepositories(100, 0);
  const { summary } = useDashboard();
  const activeJobs = summary?.metrics?.active_indexing_jobs ?? 0;

  const active = React.useMemo(
    () =>
      (repositories ?? []).filter((r) =>
        ['running', 'in_progress', 'pending', 'queued'].includes((r.latest_job_status ?? '').toLowerCase())
      ),
    [repositories]
  );

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/40 px-4 py-3 backdrop-blur-xl">
        <Activity className="h-4 w-4 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">Indexing idle</p>
          <p className="text-xs text-muted-foreground">
            {activeJobs === 0 ? 'All repositories are up to date' : `${activeJobs} queued job(s)`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-warning/20 bg-warning/5 p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
        </span>
        <h3 className="text-sm font-semibold text-foreground lg:text-base">Indexing now</h3>
      </div>
      <ul className="space-y-2">
        {active.map((repo) => (
          <li
            key={repo.id}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm"
          >
            <span className="truncate font-medium">{repo.repo_id}</span>
            <span className="shrink-0 text-xs uppercase tracking-wide text-warning">{repo.latest_job_status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardActivityRow() {
  return (
    <div className={cn('grid grid-cols-1 gap-4', 'xl:grid-cols-3')}>
      <div className="space-y-4 xl:col-span-2">
        <RecentSessionsCard />
        <DashboardMomentumChart />
      </div>
      <div>
        <IndexingNowCard />
      </div>
    </div>
  );
}
