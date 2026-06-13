'use client';

import * as React from 'react';
import { Plus, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DASHBOARD_EYEBROW } from '@/components/layout/nav-tokens';
import { DashboardAddRepository } from '@/features/dashboard/components/dashboard-add-repository';
import { DashboardActivityRow } from '@/features/dashboard/components/dashboard-activity-row';
import { DashboardContinueCard } from '@/features/dashboard/components/dashboard-continue-card';
import { DashboardQuickActions } from '@/features/dashboard/components/dashboard-quick-actions';
import { DashboardRecentRepositories } from '@/features/dashboard/components/dashboard-recent-repositories';
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

  const addRepositoryControl = (
    <DashboardAddRepository
      open={addRepoOpen}
      onOpenChange={setAddRepoOpen}
      triggerRef={addRepoRef}
      triggerVariant="default"
      triggerClassName="h-12 flex-1 gap-2 shadow-glow-sm sm:flex-1"
      triggerLabel="Add repository"
    />
  );

  return (
    <div className="w-full space-y-8 py-6 animate-in fade-in duration-500 lg:space-y-10 lg:py-8 xl:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card/90 via-card/50 to-primary/[0.06] shadow-premium">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.07]" />
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-ai/10 blur-3xl" />

        <div className="relative grid gap-8 p-6 lg:grid-cols-12 lg:items-stretch lg:gap-10 lg:p-8 xl:p-10">
          <div className="flex flex-col justify-center space-y-4 lg:col-span-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className={DASHBOARD_EYEBROW}>Developer Dashboard</span>
              <Badge variant="secondary" className="text-xs uppercase">
                {role}
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground lg:text-4xl xl:text-5xl">
              Welcome back, {displayName}
            </h1>
            <p className="max-w-xl text-sm font-light leading-relaxed text-muted-foreground lg:text-base xl:text-lg">
              Add repositories, run indexing, then open your codebase to chat and search.
            </p>
          </div>

          <div className="lg:col-span-7">
            <DashboardContinueCard
              session={continueSession}
              repository={primaryRepo}
              addRepositoryAction={addRepositoryControl}
              className="h-full border-border/40 bg-background/40"
            />
          </div>
        </div>
      </section>

      <DashboardSection title="Overview" description="Platform metrics at a glance">
        <DashboardStatsGrid />
      </DashboardSection>

      <DashboardSection title="Quick Actions" description="Common engineering workflows">
        <DashboardQuickActions onAddRepository={openAddRepository} />
      </DashboardSection>

      <DashboardSection title="Activity" description="Recent sessions and weekly usage">
        <DashboardActivityRow />
      </DashboardSection>

      <DashboardSection
        title="Repositories"
        description="Indexed codebases in your project"
        action={
          <Button size="lg" className="h-11 gap-2 px-5 shadow-glow-sm" onClick={openAddRepository}>
            <Plus className="h-4 w-4" />
            Add repository
          </Button>
        }
      >
        <DashboardRecentRepositories summaryRepos={summary?.recent_repositories} />
      </DashboardSection>
    </div>
  );
}
