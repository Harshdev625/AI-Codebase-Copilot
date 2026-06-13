'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDashboardActivity } from '@/features/dashboard/hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function DashboardMomentumChart() {
  const { data, isLoading } = useDashboardActivity(7);

  const chartData = React.useMemo(() => {
    const days = data?.days ?? [];
    return days.map((d) => ({
      day: format(parseISO(d.date), 'EEE'),
      date: d.date,
      queries: d.sessions,
      indexing: d.indexing_jobs_completed,
    }));
  }, [data]);

  const maxVal = Math.max(1, ...chartData.map((d) => Math.max(d.queries, d.indexing)));
  const totalQueries = chartData.reduce((s, d) => s + d.queries, 0);
  const totalIndexing = chartData.reduce((s, d) => s + d.indexing, 0);
  const hasActivity = totalQueries > 0 || totalIndexing > 0;

  if (isLoading) {
    return <Skeleton className="min-h-[200px] w-full rounded-3xl lg:min-h-[240px]" />;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-premium backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-10" />
      <div className="relative mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground xl:text-lg">Weekly Activity</h3>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm xl:text-base">
            Last 7 days — chat sessions and completed indexing jobs
          </p>
        </div>
      </div>

      <div
        className={cn(
          'relative flex items-end justify-between gap-2',
          hasActivity ? 'min-h-[220px] lg:min-h-[260px] xl:min-h-[280px]' : 'min-h-[120px] lg:min-h-[140px]',
        )}
      >
        {!hasActivity ? (
          <div className="flex h-full min-h-[120px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center lg:min-h-[140px]">
            <Activity className="mb-2 h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No activity in the last 7 days</span>
          </div>
        ) : (
          chartData.map((d, i) => {
            const heightPct = (Math.max(d.queries, d.indexing) / maxVal) * 100;
            return (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-full w-full flex-col justify-end">
                  <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/40 bg-background/95 px-2 py-1 text-xs shadow-lg group-hover:block">
                    {d.queries} sessions · {d.indexing} indexes
                  </div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5 }}
                    className="min-h-[4px] w-full rounded-t-lg bg-gradient-to-t from-primary/80 to-primary/30"
                  />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.day}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-border/40 pt-5">
        <div>
          <div className="text-sm font-semibold text-foreground lg:text-base">Sessions</div>
          <div className="mb-1 text-xs text-muted-foreground lg:text-sm">Last 7 days</div>
          <span className="text-2xl font-semibold tabular-nums lg:text-3xl xl:text-4xl">{totalQueries}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground lg:text-base">Completed indexes</div>
          <div className="mb-1 text-xs text-muted-foreground lg:text-sm">Last 7 days</div>
          <span className="text-2xl font-semibold tabular-nums lg:text-3xl xl:text-4xl">{totalIndexing}</span>
        </div>
      </div>
    </div>
  );
}
