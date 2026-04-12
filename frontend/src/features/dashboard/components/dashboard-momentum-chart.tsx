'use client';

import * as React from 'react';
import { Surface } from '@/components/ui/surface';
import { motion } from 'framer-motion';
import { Activity, TrendingUp } from 'lucide-react';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function generateWeekData() {
  return WEEK_DAYS.map((day) => ({
    day,
    queries: Math.floor(Math.random() * 28) + 2,
    indexing: Math.floor(Math.random() * 12) + 1,
  }));
}

export function DashboardMomentumChart() {
  const [data, setData] = React.useState<{ day: string; queries: number; indexing: number }[]>([]);

  React.useEffect(() => {
    setData(generateWeekData());
  }, []);

  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.queries)) : 1;
  const totalQueries = data.reduce((s, d) => s + d.queries, 0);
  const totalIndexing = data.reduce((s, d) => s + d.indexing, 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/6 bg-[hsl(240,18%,6%)] p-6 shadow-premium">
      {/* Mesh BG */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-10" />
      <div className="pointer-events-none absolute right-0 -top-12 h-40 w-40 rounded-full bg-violet-500/10 blur-[50px]" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-white/90">Weekly Activity</h3>
          <p className="text-[11px] text-zinc-600 mt-0.5">AI queries and indexing events</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-400" />
          </span>
          Live
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end justify-between gap-2 h-36">
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full border border-dashed border-white/6 rounded-2xl bg-white/2 gap-3">
            <Activity className="h-6 w-6 text-zinc-700 animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Telemetry Offline</span>
          </div>
        ) : (
          data.map((d, i) => {
            const heightPct = (d.queries / maxVal) * 100;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5 group">
                <div className="relative w-full flex flex-col justify-end h-full">
                  {/* Tooltip */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 whitespace-nowrap rounded-xl border border-violet-500/20 bg-[hsl(240,18%,8%)] px-2.5 py-1.5 text-[10px] font-bold shadow-xl z-10">
                    <Activity className="h-2.5 w-2.5 text-violet-400" />
                    <span className="text-violet-300">{d.queries}</span>
                    <span className="text-zinc-600">queries</span>
                  </div>
                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${heightPct}%`, opacity: 1 }}
                    transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full min-h-[4px] rounded-t-xl bg-gradient-to-t from-violet-600/60 to-violet-400 group-hover:from-violet-500 group-hover:to-indigo-300 transition-all duration-300 shadow-[0_-2px_8px_-2px_hsl(265,80%,65%,0.3)] group-hover:shadow-[0_-4px_16px_-2px_hsl(265,80%,65%,0.6)]"
                  />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-700 group-hover:text-violet-500/60 transition-colors">
                  {d.day}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="relative grid grid-cols-2 gap-4 border-t border-white/5 mt-5 pt-5">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-700 mb-1">Total Queries (7d)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-white/80">{totalQueries}</span>
            <span className="text-[10px] text-zinc-700 font-medium">queries</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-700 mb-1">Index Events (7d)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-white/80">{totalIndexing}</span>
            <span className="text-[10px] text-zinc-700 font-medium">syncs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
