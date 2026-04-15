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
    completed: 'bg-emerald-400 shadow-[0_0_6px_2px_hsl(142,65%,45%,0.5)]',
    pending:   'bg-amber-400 animate-pulse shadow-[0_0_6px_2px_hsl(38,92%,50%,0.4)]',
    running:   'bg-amber-400 animate-pulse shadow-[0_0_6px_2px_hsl(38,92%,50%,0.4)]',
    failed:    'bg-red-400 shadow-[0_0_6px_2px_hsl(0,84%,60%,0.4)]',
  };
  return (
    <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', colorMap[s] ?? 'bg-zinc-700')} />
  );
}

/* ── Main component ───────────────────────────────────────── */
export function DashboardRecentRepositories() {
  const { summary, isLoading } = useDashboard();
  const router = useRouter();
  const plan = String(summary?.usage?.plan_tier || 'free').toUpperCase();
  const maxReposPerProject = summary?.usage?.limits?.max_repositories_per_project ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/3" />
        ))}
      </div>
    );
  }

  const repos = summary?.recent_repositories ?? [];

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-5 rounded-3xl border border-dashed border-white/6 bg-[hsl(240,18%,6%)]">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl rounded-full bg-violet-500/10 animate-glow-pulse" />
          <div className="relative h-12 w-12 rounded-2xl bg-[hsl(240,18%,9%)] border border-white/6 flex items-center justify-center">
            <FolderGit2 className="h-5 w-5 text-zinc-700" />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-700">No Sources Linked</p>
          <p className="text-[10px] text-zinc-800 mt-1">Connect a repository to begin analysis</p>
          <p className="text-[10px] text-zinc-700 mt-1">{plan} plan supports up to {maxReposPerProject} repositories per project.</p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push('/repositories')}
          className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 border-0 shadow-glow-sm hover:shadow-glow-md gap-1.5 transition-all"
        >
          <Plus className="h-3 w-3" />
          Link Repository
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/6 bg-[hsl(240,18%,6%)] overflow-hidden shadow-premium animate-fade-up">
      {repos.map((repo, i) => (
        <div
          key={repo.id}
          onClick={() => router.push('/chat')}
          className={cn(
            'group flex items-center justify-between px-5 py-4 transition-all duration-200 cursor-pointer',
            'hover:bg-violet-500/5 hover:border-l-2 hover:border-l-violet-500/40',
            i !== 0 && 'border-t border-white/4'
          )}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Repo icon */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(240,18%,9%)] border border-white/6 transition-all duration-300 group-hover:border-violet-500/25 group-hover:shadow-[0_0_12px_-4px_hsl(265,80%,65%,0.3)]">
              <FolderGit2 className="h-4.5 w-4.5 text-zinc-700 group-hover:text-violet-400 transition-colors" />
            </div>

            <div className="min-w-0">
              <h4 className="text-[13px] font-bold tracking-tight text-zinc-300 group-hover:text-violet-300 transition-colors truncate">
                {repo.repo_id}
              </h4>
              <div className="flex items-center gap-3 mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700">
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
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                {repo.latest_index_status || 'Unprocessed'}
              </span>
            </div>
            <div className="h-7 w-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-500/10 text-violet-400 border border-violet-500/20 transition-all group-hover:shadow-[0_0_8px_-2px_hsl(265,80%,65%,0.4)]">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
