'use client';

import * as React from 'react';
import { useDashboard } from '../hooks/use-dashboard';
import { Surface } from '@/components/ui/surface';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderGit2, Layers3, Activity, MessageSquare, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';



export function DashboardStatsGrid() {
  const { summary, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <Skeleton className="h-32 w-full rounded-2xl border border-border/40" />
    );
  }

  const metrics = summary?.metrics;

  const stats = [
    {
      label: 'Intelligence Depth',
      value: metrics?.indexed_chunks_count ?? 0,
      suffix: 'chunks',
      icon: <Layers3 className="h-4 w-4" />,
      color: 'text-emerald-500',
    },
    {
      label: 'Monitored Assets',
      value: metrics?.repositories_count ?? 0,
      suffix: 'repos',
      icon: <FolderGit2 className="h-4 w-4" />,
      color: 'text-indigo-500',
    },
    {
      label: 'AI Knowledge',
      value: (metrics as any)?.chat_count ?? 0,
      suffix: 'queries',
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-violet-500',
    },
    {
      label: 'Active Context',
      value: metrics?.projects_count ?? 0,
      suffix: 'groups',
      icon: <Activity className="h-4 w-4" />,
      color: 'text-primary',
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
        {stats.map((stat, i) => (
          <div key={i} className="group p-6 flex flex-col gap-3 hover:bg-muted/30 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                {stat.label}
              </span>
              <div className={cn("rounded-lg p-1.5 bg-background border border-border/40 shadow-sm", stat.color)}>
                {stat.icon}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight tabular-nums font-mono">
                {stat.value.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold uppercase text-muted-foreground/30">
                {stat.suffix}
              </span>
            </div>
            {/* Minimal sparkline indicator */}
            <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
               <div className={cn("h-full rounded-full transition-all duration-1000", stat.color.replace('text', 'bg'))} style={{ width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
