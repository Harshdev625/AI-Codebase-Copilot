'use client';

import * as React from 'react';
import { RefreshCw, Sparkles, TrendingUp, Cpu, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DashboardStatsGrid } from '@/features/dashboard/components/dashboard-stats-grid';
import { DashboardRecentRepositories } from '@/features/dashboard/components/dashboard-recent-repositories';
import { DashboardMomentumChart } from '@/features/dashboard/components/dashboard-momentum-chart';
import { DashboardQuickActions } from '@/features/dashboard/components/dashboard-quick-actions';
import { OnboardingOverlay } from '@/components/shared/onboarding-overlay';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { useAuthStore } from '@/store/auth-store';

/* ── Animated greeting time computation ─────────────────── */
function useGreeting(): string {
  const [greeting, setGreeting] = React.useState('Hello');
  React.useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);
  return greeting;
}

/* ── Hero banner component ─────────────────────────────── */
function HeroBanner({ greeting, name, isLoading, onRefresh }: {
  greeting: string;
  name: string;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/6 bg-[hsl(240,18%,6%)] p-8 shadow-premium">
      {/* Mesh gradients */}
      <div className="pointer-events-none absolute inset-0 mesh-gradient" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />

      {/* Glow orbs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/15 blur-[70px]" />
      <div className="pointer-events-none absolute right-32 bottom-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-[50px]" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: greeting */}
        <div className="flex items-start gap-4">
          <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow-md animate-float">
            <Sparkles className="h-6 w-6 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-40 blur-lg -z-10" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-violet-400/70">
                Workspace Overview
              </span>
              <span className="h-1 w-1 rounded-full bg-violet-400/50" />
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                AI Codebase Copilot
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-white/70">{greeting}, </span>
              <span className="gradient-text">{name}</span>
            </h1>
            <p className="text-[12px] text-zinc-500 mt-1 max-w-md font-medium">
              Monitor indexing health, codebase momentum, and intelligence logs across your connected sources.
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9 px-4 border-white/8 bg-white/3 backdrop-blur-sm hover:bg-white/6 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
          >
            <RefreshCw className={cn("mr-2 h-3 w-3", isLoading && "animate-spin")} />
            Sync State
          </Button>
          <Button
            size="sm"
            className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider shadow-glow-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 gap-1.5 transition-all hover:shadow-[0_0_24px_-4px_hsl(265,80%,65%,0.6)]"
          >
            New Project
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Bottom accent: agent status row */}
      <div className="relative mt-6 flex items-center gap-4 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">LangGraph Online</span>
        </div>
        <div className="h-3 w-px bg-white/6" />
        <Cpu className="h-3 w-3 text-zinc-700" />
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Retrieval Engine v2.4</span>
        <div className="h-3 w-px bg-white/6" />
        <TrendingUp className="h-3 w-3 text-violet-500/50" />
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Embedding Model Loaded</span>
      </div>
    </div>
  );
}

/* ── Dashboard page ─────────────────────────────────────── */
export default function DashboardPage() {
  const { refetch, isLoading } = useDashboard();
  const { user } = useAuthStore();
  const greeting = useGreeting();

  const firstName =
    user?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there';

  return (
    <>
      <OnboardingOverlay />

      <div className="space-y-8 animate-fade-up">
        {/* Hero Banner */}
        <HeroBanner
          greeting={greeting}
          name={firstName}
          isLoading={isLoading}
          onRefresh={() => void refetch()}
        />

        {/* Stats Grid */}
        <section>
          <DashboardStatsGrid />
        </section>

        {/* Main content + sidebar widgets */}
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main column */}
          <div className="flex-1 space-y-10">
            <section>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Productivity Momentum</span>
                <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent" />
              </div>
              <DashboardMomentumChart />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Linked Sources</span>
                <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent" />
              </div>
              <DashboardRecentRepositories />
            </section>
          </div>

          {/* Sidebar widgets */}
          <div className="lg:w-72 shrink-0 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Quick Actions</span>
              </div>
              <DashboardQuickActions />
            </section>

            {/* AI Tip card */}
            <section>
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-[hsl(265,50%,8%)] p-5">
                {/* glow orb */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/15 blur-[40px]" />
                <div className="relative">
                  <h4 className="flex items-center gap-2 text-[11px] font-bold text-violet-300 mb-2">
                    <Sparkles className="h-3 w-3" />
                    Pro Tip
                  </h4>
                  <p className="text-[11px] leading-relaxed text-zinc-500 font-medium">
                    Use the <span className="text-violet-400 font-bold">Index All</span> command in repository settings to give the AI full visibility across your recent commits before starting a chat session.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
