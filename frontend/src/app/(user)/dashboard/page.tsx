'use client';

import * as React from 'react';
import { DashboardStatsGrid } from '@/features/dashboard/components/dashboard-stats-grid';
import { DashboardRecentRepositories } from '@/features/dashboard/components/dashboard-recent-repositories';
import { DashboardAddRepository } from '@/features/dashboard/components/dashboard-add-repository';
import { Sparkles } from 'lucide-react';

export default function UserDashboard() {
  return (
    <div className="container mx-auto px-6 py-8 space-y-8 max-w-7xl animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              AI Codebase Copilot
            </span>
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Developer Dashboard
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            Monitor codebase health, index status, and recent activity.
          </p>
        </div>
        <div className="shrink-0">
          <DashboardAddRepository />
        </div>
      </header>

      {/* Stats Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Overview
        </h2>
        <DashboardStatsGrid />
      </section>

      {/* Repository List */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Repositories
        </h2>
        <DashboardRecentRepositories />
      </section>
    </div>
  );
}
