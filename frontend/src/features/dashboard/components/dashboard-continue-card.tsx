'use client';

import Link from 'next/link';
import { ArrowRight, FolderGit2, GitBranch, Loader2, MessageSquare, PlayCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DASHBOARD_EYEBROW } from '@/components/layout/nav-tokens';
import { cn } from '@/lib/utils';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import { isRepositoryIndexed } from '@/features/dashboard/utils/repo-index-status';
import type { DashboardRecentSession, DashboardRecentRepository } from '@/features/dashboard/types/dashboard-types';

interface DashboardContinueCardProps {
  session?: DashboardRecentSession | null;
  repository?: DashboardRecentRepository | null;
  addRepositoryAction?: React.ReactNode;
  className?: string;
}

export function DashboardContinueCard({
  session,
  repository,
  addRepositoryAction,
  className,
}: DashboardContinueCardProps) {
  const indexMutation = useIndexRepository();
  const indexed = isRepositoryIndexed(repository);
  const repoId = session?.repository_id ?? repository?.id;
  const href = repoId
    ? `/studio?repository_id=${repoId}${session?.id ? `&session_id=${session.id}` : ''}`
    : '/studio';

  const repoName = repository?.repo_id ?? (session?.repository_id ? 'Linked repository' : null);
  const sessionTitle = session?.session_title?.trim();
  const hasSession = Boolean(session);
  const title = sessionTitle || repoName || 'Your codebase workspace';
  const subtitle = hasSession
    ? `${session!.session_mode} session${repoName ? ` · ${repoName}` : ''}`
    : repoName
      ? indexed
        ? `Continue with ${repoName}`
        : `${repoName} needs indexing before you can open the codebase`
      : 'Add a repository and index it to get started';

  const canOpenCodebase = indexed && Boolean(repoId);
  const canStartIndexing = Boolean(repository?.id) && !indexed && !indexMutation.isPending;

  const handleStartIndexing = () => {
    if (!repository?.id) return;
    indexMutation.mutate({ repository_id: repository.id, full_reindex: false });
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-premium backdrop-blur-xl',
        className,
      )}
    >
      <div className="relative p-5 lg:p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-ai/5" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 lg:h-14 lg:w-14">
              {hasSession ? (
                <MessageSquare className="h-6 w-6 text-primary lg:h-7 lg:w-7" />
              ) : (
                <FolderGit2 className="h-6 w-6 text-primary lg:h-7 lg:w-7" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={DASHBOARD_EYEBROW}>Resume workspace</p>
              <h2 className="mt-1 break-words font-display text-xl font-semibold leading-tight tracking-tight text-foreground lg:text-2xl">
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground lg:text-base">{subtitle}</p>
              {repository?.default_branch && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <GitBranch className="h-3 w-3" />
                    {repository.default_branch}
                  </Badge>
                  {repository.latest_job_status && (
                    <Badge
                      variant={
                        repository.latest_job_status === 'completed'
                          ? 'success'
                          : repository.latest_job_status === 'failed'
                            ? 'error'
                            : 'warning'
                      }
                      className="text-xs uppercase"
                    >
                      {repository.latest_job_status}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {canOpenCodebase ? (
              <Button asChild size="lg" className="h-12 flex-1 gap-2 shadow-glow-sm sm:flex-[1.4]">
                <Link href={href}>
                  <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{hasSession ? 'Continue session' : 'Open codebase'}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </Button>
            ) : canStartIndexing ? (
              <Button
                size="lg"
                className="h-12 flex-1 gap-2 shadow-glow-sm sm:flex-[1.4]"
                onClick={handleStartIndexing}
                disabled={indexMutation.isPending}
              >
                {indexMutation.isPending ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 shrink-0" />
                )}
                Start indexing
              </Button>
            ) : null}
            {addRepositoryAction}
          </div>
        </div>
      </div>
    </div>
  );
}
