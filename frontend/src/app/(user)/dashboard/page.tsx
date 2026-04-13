'use client';

import * as React from 'react';
import { RefreshCw, Sparkles, TrendingUp, Cpu, ArrowRight, Plus } from 'lucide-react';
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
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/6 bg-[hsl(240,18%,6%)] p-4 sm:p-6 md:p-8 shadow-premium">
      {/* Mesh gradients */}
      <div className="pointer-events-none absolute inset-0 mesh-gradient" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />

      {/* Glow orbs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/15 blur-[70px]" />
      <div className="pointer-events-none absolute right-32 bottom-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-[50px]" />

      <div className="relative flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left: greeting */}
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div className="relative h-10 sm:h-12 w-10 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow-md animate-float flex-shrink-0">
            <Sparkles className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-40 blur-lg -z-10" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em] text-violet-400/70">
                Workspace Overview
              </span>
              <span className="h-1 w-1 rounded-full bg-violet-400/50" />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                AI Codebase Copilot
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              <span className="text-white/70">{greeting}, </span>
              <span className="gradient-text">{name}</span>
            </h1>
            <p className="text-[11px] sm:text-[12px] text-zinc-500 mt-1 max-w-md font-medium">
              Monitor indexing health, codebase momentum, and intelligence logs across your connected sources.
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex-1 md:flex-none h-8 sm:h-9 px-3 sm:px-4 border-white/8 bg-white/3 backdrop-blur-sm hover:bg-white/6 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
          >
            <RefreshCw className={cn("mr-1.5 sm:mr-2 h-3 w-3", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Sync State</span>
            <span className="sm:hidden">Sync</span>
          </Button>
          <Button
            size="sm"
            className="flex-1 md:flex-none h-8 sm:h-9 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-glow-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 gap-1 sm:gap-1.5 transition-all hover:shadow-[0_0_24px_-4px_hsl(265,80%,65%,0.6)]"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Bottom accent: agent status row */}
      <div className="relative mt-4 sm:mt-6 flex flex-wrap items-center gap-2 sm:gap-4 border-t border-white/5 pt-3 sm:pt-4 overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </div>
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">LangGraph Online</span>
        </div>
        <div className="h-3 w-px bg-white/6 hidden sm:block" />
        <Cpu className="h-3 w-3 text-zinc-700 flex-shrink-0 hidden sm:block" />
        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 hidden sm:inline">Retrieval Engine v2.4</span>
        <div className="h-3 w-px bg-white/6 hidden md:block" />
        <TrendingUp className="h-3 w-3 text-violet-500/50 flex-shrink-0 hidden md:block" />
        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 hidden md:inline">Embedding Model Loaded</span>
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
        <div className="flex flex-col xl:flex-row gap-8 lg:gap-12">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-8 sm:space-y-10">
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-5 flex-wrap">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent min-w-[12px]" />
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 flex-shrink-0">Productivity Momentum</span>
                <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent min-w-[12px]" />
              </div>
              <DashboardMomentumChart />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-5 flex-wrap">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent min-w-[12px]" />
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 flex-shrink-0">Linked Sources</span>
                <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent min-w-[12px]" />
              </div>
              <DashboardRecentRepositories />
            </section>
          </div>

          {/* Sidebar widgets */}
          <div className="xl:w-72 lg:w-64 shrink-0 space-y-6 sm:space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-5 flex-wrap">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent min-w-[12px]" />
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 flex-shrink-0">Quick Actions</span>
              </div>
              <DashboardQuickActions />
            </section>

            {/* AI Tip card */}
            <section>
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/15 bg-[hsl(265,50%,8%)] p-4 sm:p-5 hover:border-violet-500/30 transition-colors duration-300">
                {/* glow orb */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/15 blur-[40px]" />
                <div className="relative">
                  <h4 className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-violet-300 mb-2">
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    Pro Tip
                  </h4>
                  <p className="text-[10px] sm:text-[11px] leading-relaxed text-zinc-500 font-medium">
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
