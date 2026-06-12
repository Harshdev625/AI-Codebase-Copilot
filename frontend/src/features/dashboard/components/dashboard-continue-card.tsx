'use client';

import Link from 'next/link';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardRecentSession, DashboardRecentRepository } from '@/features/dashboard/types/dashboard-types';

interface DashboardContinueCardProps {
  session?: DashboardRecentSession | null;
  repository?: DashboardRecentRepository | null;
}

export function DashboardContinueCard({ session, repository }: DashboardContinueCardProps) {
  const repoId = session?.repository_id ?? repository?.id;
  const href = repoId
    ? `/studio?repository_id=${repoId}${session?.id ? `&session_id=${session.id}` : ''}`
    : '/studio';

  const title = session?.session_title?.trim() || repository?.repo_id || 'Open codebase workspace';
  const subtitle = session
    ? `${session.session_mode} session`
    : repository
      ? `Continue with ${repository.repo_id}`
      : 'Launch the engineering workspace';

  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-card/60 p-5 backdrop-blur-xl sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary lg:text-xs">
          Continue where you left off
        </p>
        <p className="mt-1 truncate font-display text-lg font-semibold text-foreground lg:text-xl">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Button asChild className="shrink-0 gap-2">
        <Link href={href}>
          <PlayCircle className="h-4 w-4" />
          Continue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
