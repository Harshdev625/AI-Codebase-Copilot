'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../hooks/use-dashboard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { GitBranch, Calendar, FolderGit2, ArrowUpRight, Plus } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

/* ── Status dot ─────────────────────────────────────────── */
function StatusDot({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  const colorMap: Record<string, string> = {
    completed: 'bg-success shadow-[0_0_6px_2px_hsl(var(--success)/0.4)]',
    pending:   'bg-warning animate-pulse shadow-[0_0_6px_2px_hsl(var(--warning)/0.4)]',
    running:   'bg-warning animate-pulse shadow-[0_0_6px_2px_hsl(var(--warning)/0.4)]',
    failed:    'bg-error shadow-[0_0_6px_2px_hsl(var(--error)/0.35)]',
  };
  return (
    <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', colorMap[s] ?? 'bg-muted-foreground/40')} />
  );
}

/* ── Main component ───────────────────────────────────────── */
export function DashboardRecentRepositories() {
  const { summary, isLoading } = useDashboard();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl bg-card/60" />
        ))}
      </div>
    );
  }

  const repos = summary?.recent_repositories ?? [];

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-5 rounded-3xl border border-dashed border-border/60 bg-card/60">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl rounded-full bg-primary/15 animate-glow-pulse" />
          <div className="relative h-12 w-12 rounded-2xl bg-background/60 border border-border/60 flex items-center justify-center">
            <FolderGit2 className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">No Sources Linked</p>
          <p className="text-[10px] text-muted-foreground mt-1">Connect a repository to begin analysis</p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push('/repositories')}
          className="h-8 px-4 text-[10px] font-semibold uppercase tracking-wider bg-primary text-primary-foreground border-0 shadow-glow-sm hover:shadow-glow-md gap-1.5 transition-all"
        >
          <Plus className="h-3 w-3" />
          Link Repository
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card/80 overflow-hidden shadow-premium animate-fade-up">
      {repos.map((repo, i) => (
        <div
          key={repo.id}
          onClick={() => router.push('/chat')}
          className={cn(
            'group flex items-center justify-between px-5 py-4 transition-all duration-200 cursor-pointer',
            'hover:bg-primary/5 hover:border-l-2 hover:border-l-primary/40',
            i !== 0 && 'border-t border-border/40'
          )}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Repo icon */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/60 border border-border/60 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.35)]">
              <FolderGit2 className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>

            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                {repo.repo_id}
              </h4>
              <div className="flex items-center gap-3 mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-2.5 w-2.5" />
                  {repo.default_branch}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(repo.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <StatusDot status={repo.latest_index_status ?? undefined} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {repo.latest_index_status || 'Unprocessed'}
              </span>
            </div>
            <div className="h-7 w-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 bg-primary/10 text-primary border border-primary/20 transition-all group-hover:shadow-[0_0_8px_-2px_hsl(var(--primary)/0.35)]">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
