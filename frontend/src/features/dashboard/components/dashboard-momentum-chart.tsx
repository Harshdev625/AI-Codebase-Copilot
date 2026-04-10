'use client';

import * as React from 'react';
import { Surface } from '@/components/ui/surface';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

// Simulated 7-day activity data (would come from API in production)
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hourLabels = ['0h', '6h', '12h', '18h', '24h'];

function generateWeekData() {
  return weekDays.map((day) => ({
    day,
    queries: Math.floor(Math.random() * 24),
    indexing: Math.floor(Math.random() * 10),
  }));
}

export function DashboardMomentumChart() {
  const [data, setData] = React.useState<{day: string, queries: number, indexing: number}[]>([]);
  
  React.useEffect(() => {
    setData(generateWeekData());
  }, []);

  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.queries)) : 0;

  return (
    <Surface variant="flat" className="p-6 overflow-hidden flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight">Weekly Activity</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">AI queries and indexing events</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-primary/8 border border-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          Live
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-2 h-32">
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full border border-dashed border-border/20 rounded-xl bg-muted/5 gap-3">
             <Activity className="h-6 w-6 text-muted-foreground/20 animate-pulse" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20">Telemetry Offline</span>
          </div>
        ) : (
          data.map((d, i) => {
            const height = maxVal > 0 ? (d.queries / maxVal) * 100 : 0;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5 group">
                <div className="relative w-full flex flex-col justify-end h-full">
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 whitespace-nowrap rounded-lg border border-border/50 bg-card px-2 py-1 text-[10px] font-bold shadow-xl z-10">
                    <Activity className="h-2.5 w-2.5 text-primary" />
                    {d.queries} queries
                  </div>
                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full min-h-[3px] rounded-t-lg bg-gradient-to-t from-primary/60 to-primary group-hover:from-primary group-hover:to-indigo-400 transition-colors duration-200"
                  />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  {d.day}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Legend + stats */}
      <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-5">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
            Total Queries (7d)
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {data.reduce((s, d) => s + d.queries, 0)}
            <span className="text-xs text-muted-foreground/40 font-medium ml-1">queries</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
            Index Events (7d)
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {data.reduce((s, d) => s + d.indexing, 0)}
            <span className="text-xs text-muted-foreground/40 font-medium ml-1">syncs</span>
          </div>
        </div>
      </div>
    </Surface>
  );
}
