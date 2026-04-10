'use client';

import * as React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DashboardStatsGrid } from '@/features/dashboard/components/dashboard-stats-grid';
import { DashboardRecentRepositories } from '@/features/dashboard/components/dashboard-recent-repositories';
import { DashboardMomentumChart } from '@/features/dashboard/components/dashboard-momentum-chart';
import { DashboardQuickActions } from '@/features/dashboard/components/dashboard-quick-actions';
import { OnboardingOverlay } from '@/components/shared/onboarding-overlay';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { useAuthStore } from '@/store/auth-store';

export default function DashboardPage() {
  const { refetch, isLoading } = useDashboard();
  const { user } = useAuthStore();
  const [greeting, setGreeting] = React.useState('Hello');

  React.useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const firstName = user?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';

  return (
    <>
      <OnboardingOverlay />

      <div className="space-y-10 animate-fade-up">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                Workspace Overview
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-xl">
              Monitor indexing health, codebase momentum, and intelligence logs across your connected sources.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading}
              className="h-8 px-3 border-border/40 bg-background/50 backdrop-blur-sm hover:bg-muted/50 text-[11px] font-bold uppercase tracking-wider"
            >
              <RefreshCw className={cn("mr-2 h-3 w-3", isLoading && "animate-spin")} />
              Sync State
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 text-[11px] font-bold uppercase tracking-wider shadow-ai"
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Main Stats Bar */}
        <section>
          <DashboardStatsGrid />
        </section>

        {/* High-density layout */}
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main content area */}
          <div className="flex-1 space-y-12">
            <section>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Productivity Momentum</h3>
              </div>
              <DashboardMomentumChart />
            </section>

            <section>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Linked Sources</h3>
              </div>
              <DashboardRecentRepositories />
            </section>
          </div>

          {/* Sidebar-style widgets */}
          <div className="lg:w-80 shrink-0 space-y-12 border-l border-border/10 pl-10">
             <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-6">Operations</h3>
                <DashboardQuickActions />
             </section>
             
             <section className="pt-6">
                <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
                   <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                      <Sparkles className="h-3 w-3" />
                      Pro Tip
                   </h4>
                   <p className="text-[11px] leading-relaxed text-primary/70 font-medium">
                      Use the "Index All" command in the repository settings to ensure the AI has full visibility across your recent commits.
                   </p>
                </div>
             </section>
          </div>
        </div>
      </div>
    </>
  );
}
