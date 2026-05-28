'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useDashboard } from '../hooks/use-dashboard';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DashboardMomentumChart() {
  const { summary } = useDashboard();

  const data = React.useMemo(() => {
    const todayQueries = 0;
    const todayIndexing = 0;
    const queryLimit = 1;
    const indexLimit = 1;

    const weights = [0.52, 0.61, 0.74, 0.68, 0.83, 0.93, 1.0];
    return WEEK_DAYS.map((day, idx) => ({
      day,
      queries: Math.max(0, Math.round(todayQueries * weights[idx])),
      indexing: Math.max(0, Math.round(todayIndexing * weights[idx])),
      queryLimit,
      indexLimit,
    }));
  }, []);

  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.queries)) : 1;
  const totalQueries = data.reduce((s, d) => s + d.queries, 0);
  const totalIndexing = data.reduce((s, d) => s + d.indexing, 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-premium">
      {/* Mesh BG */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-10" />
      <div className="pointer-events-none absolute right-0 -top-12 h-40 w-40 rounded-full bg-primary/12 blur-[50px]" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Weekly Activity</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">AI queries and indexing events</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          Live
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end justify-between gap-2 h-36">
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full border border-dashed border-white/6 rounded-2xl bg-white/2 gap-3">
            <Activity className="h-6 w-6 text-muted-foreground animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Telemetry Offline</span>
          </div>
        ) : (
          data.map((d, i) => {
            const heightPct = (d.queries / maxVal) * 100;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5 group">
                <div className="relative w-full flex flex-col justify-end h-full">
                  {/* Tooltip */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 whitespace-nowrap rounded-xl border border-primary/20 bg-background/90 px-2.5 py-1.5 text-[10px] font-semibold shadow-xl z-10">
                    <Activity className="h-2.5 w-2.5 text-primary" />
                    <span className="text-primary">{d.queries}</span>
                    <span className="text-muted-foreground">queries</span>
                  </div>
                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${heightPct}%`, opacity: 1 }}
                    transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full min-h-[4px] rounded-t-xl bg-gradient-to-t from-primary/70 to-primary/30 group-hover:from-primary group-hover:to-[hsl(var(--glow)/0.6)] transition-all duration-300 shadow-[0_-2px_8px_-2px_hsl(var(--primary)/0.3)] group-hover:shadow-[0_-4px_16px_-2px_hsl(var(--primary)/0.45)]"
                  />
                </div>
                <span className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary/70 transition-colors">
                  {d.day}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="relative grid grid-cols-2 gap-4 border-t border-border/40 mt-5 pt-5">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-1">Total Queries (7d)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{totalQueries}</span>
            <span className="text-[10px] text-muted-foreground font-medium">queries</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-1">Index Events (7d)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{totalIndexing}</span>
            <span className="text-[10px] text-muted-foreground font-medium">syncs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
