'use client';

import * as React from 'react';
import { Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDashboardActivity } from '@/features/dashboard/hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function DashboardMomentumChart() {
  const { data, isLoading } = useDashboardActivity(7);

  const chartData = React.useMemo(() => {
    const days = data?.days ?? [];
    return days.map((d) => ({
      day: format(parseISO(d.date), 'EEE'),
      fullDate: format(parseISO(d.date), 'MMM d, yyyy'),
      date: d.date,
      queries: d.sessions,
      indexing: d.indexing_jobs_completed,
    }));
  }, [data]);

  const totalQueries = chartData.reduce((s, d) => s + d.queries, 0);
  const totalIndexing = chartData.reduce((s, d) => s + d.indexing, 0);
  const hasActivity = totalQueries > 0 || totalIndexing > 0;

  if (isLoading) {
    return <Skeleton className="min-h-[200px] w-full rounded-3xl lg:min-h-[240px]" />;
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload;
      return (
        <div className="rounded-xl border border-border/50 bg-background/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl">
          <div className="mb-2 font-bold text-foreground">{pointData.fullDate}</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-ai shadow-[0_0_5px_rgba(100,100,255,0.6)]" />
                Sessions
              </span>
              <span className="font-semibold text-foreground">{pointData.queries}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_5px_rgba(34,197,94,0.6)]" />
                Indexing Jobs
              </span>
              <span className="font-semibold text-foreground">{pointData.indexing}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 dark:border-white/10 bg-card/60 dark:bg-card/40 p-6 shadow-premium backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-10" />
      <div className="relative mb-6 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 sm:gap-0">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground xl:text-lg">Weekly Activity</h3>
          <p className="mt-0.5 text-xs text-muted-foreground lg:text-sm xl:text-base">
            Last 7 days — chat sessions and completed indexing jobs
          </p>
        </div>
        {hasActivity && (
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-ai/80" /> Sessions
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" /> Indexing
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          'relative w-full mt-4',
          hasActivity ? 'h-[240px] lg:h-[280px] xl:h-[300px]' : 'min-h-[120px] lg:min-h-[140px]',
        )}
      >
        {!hasActivity ? (
          <div className="flex h-full min-h-[120px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 bg-gradient-to-b from-muted/5 to-muted/20 px-4 py-6 text-center lg:min-h-[140px]">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border/40 shadow-sm">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">No activity in the last 7 days</span>
            <span className="mt-1 text-xs text-muted-foreground">Your chat sessions and indexing jobs will appear here.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--ai))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--ai))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorIndexing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'currentColor' }} 
                className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider"
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.2 }} />
              <Area
                type="monotone"
                dataKey="queries"
                stroke="hsl(var(--ai))"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorQueries)"
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--ai))", stroke: "hsl(var(--background))" }}
              />
              <Area
                type="monotone"
                dataKey="indexing"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorIndexing)"
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
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
