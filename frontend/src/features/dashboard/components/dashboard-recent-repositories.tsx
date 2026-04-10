'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../hooks/use-dashboard';
import { Surface } from '@/components/ui/surface';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { GitBranch, Calendar, FolderGit2, ArrowUpRight, Bot, Plus } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

function StatusDot({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  return (
    <span className={cn(
      'inline-flex h-1.5 w-1.5 rounded-full',
      s === 'completed' ? 'bg-success' :
      s === 'pending' || s === 'running' ? 'bg-warning animate-pulse' :
      s === 'failed' ? 'bg-error' :
      'bg-muted-foreground/30'
    )} />
  );
}

export function DashboardRecentRepositories() {
  const { summary, isLoading } = useDashboard();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const repos = summary?.recent_repositories ?? [];

  return (
    <div className="animate-fade-up">
      {repos.length === 0 ? (
        <Surface variant="flat" className="flex flex-col items-center justify-center py-12 text-center gap-4 bg-muted/5 border-dashed">
          <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
            <FolderGit2 className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground uppercase tracking-widest">No Sources Linked</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Connect a repository to begin analysis</p>
          </div>
          <Button size="sm" onClick={() => router.push('/repositories')} className="h-8 text-[10px] font-bold uppercase tracking-wider">
            Link Repository
          </Button>
        </Surface>
      ) : (
        <div className="divide-y divide-border/10 border-t border-border/10">
          {repos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => router.push('/chat')}
              className="group flex items-center justify-between py-4 hover:bg-muted/10 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card border border-border/40 shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:border-primary/30">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors truncate">
                    {repo.repo_id}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
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

              <div className="flex items-center gap-4 shrink-0 pr-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={repo.latest_index_status ?? undefined} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {repo.latest_index_status || 'Unprocessed'}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-primary/5 text-primary border border-primary/20 transition-all">
                   <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
