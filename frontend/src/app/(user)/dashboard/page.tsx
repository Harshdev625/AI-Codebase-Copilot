'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { DashboardAddRepository } from '@/features/dashboard/components/dashboard-add-repository';
import { DashboardActivityRow } from '@/features/dashboard/components/dashboard-activity-row';
import { DashboardContinueCard } from '@/features/dashboard/components/dashboard-continue-card';
import { DashboardQuickActions } from '@/features/dashboard/components/dashboard-quick-actions';
import { DashboardRecentRepositories } from '@/features/dashboard/components/dashboard-recent-repositories';
import { DashboardRepoSpotlight } from '@/features/dashboard/components/dashboard-repo-spotlight';
import { DashboardSection } from '@/features/dashboard/components/dashboard-section';
import { DashboardStatsGrid } from '@/features/dashboard/components/dashboard-stats-grid';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';

export default function UserDashboard() {
  const { summary } = useDashboard();
  const [addRepoOpen, setAddRepoOpen] = React.useState(false);
  const addRepoRef = React.useRef<HTMLButtonElement>(null);

  const displayName = summary?.user?.full_name?.trim() || summary?.user?.email?.split('@')[0] || 'Developer';
  const role = summary?.user?.role ?? 'USER';
  const primaryRepo = summary?.recent_repositories?.[0] ?? null;
  const continueSession = summary?.recent_sessions?.[0] ?? null;

  const openAddRepository = React.useCallback(() => {
    setAddRepoOpen(true);
    addRepoRef.current?.click();
  }, []);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 xl:space-y-10">
      <header className="flex flex-col justify-between gap-4 border-b border-border/40 pb-6 lg:flex-row lg:items-end">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary lg:text-xs">
              Developer Dashboard
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {role}
            </Badge>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="max-w-2xl text-sm font-light text-muted-foreground lg:text-base">
            Monitor repository health, indexing jobs, and jump back into your codebase workspace.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 lg:max-w-md">
          <DashboardContinueCard session={continueSession} repository={primaryRepo} />
          <DashboardAddRepository open={addRepoOpen} onOpenChange={setAddRepoOpen} triggerRef={addRepoRef} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:gap-6">
        <div className="space-y-8 xl:col-span-7 xl:space-y-6">
          <DashboardSection title="Overview" description="Platform metrics at a glance">
            <DashboardStatsGrid />
          </DashboardSection>
        </div>
        <div className="xl:col-span-5">
          <DashboardSection title="Quick Actions" description="Common engineering workflows">
            <DashboardQuickActions onAddRepository={openAddRepository} />
          </DashboardSection>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardSection title="Activity" description="Recent sessions and live indexing">
            <DashboardActivityRow />
          </DashboardSection>
        </div>
        <div className="xl:col-span-4">
          <DashboardSection title="Spotlight" description="Primary repository health">
            <DashboardRepoSpotlight repository={primaryRepo} />
          </DashboardSection>
        </div>
      </div>

      <DashboardSection title="Repositories" description="Indexed codebases in your project">
        <DashboardRecentRepositories summaryRepos={summary?.recent_repositories} />
      </DashboardSection>
    </div>
  );
}
