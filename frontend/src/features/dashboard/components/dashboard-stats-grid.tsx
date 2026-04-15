'use client';

import * as React from 'react';
import { useDashboard } from '../hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderGit2, Layers3, Activity, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Animated count-up hook ─────────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      /* Ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* ── Single stat card ─────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  delay: number;
}

function StatCard({ label, value, suffix, icon, gradient, glowColor, delay }: StatCardProps) {
  const displayed = useCountUp(value);

  return (
    <div
      className="group relative flex flex-col gap-3 p-6 bg-[hsl(240,18%,7%)] transition-all duration-300 hover:bg-[hsl(240,18%,8%)] overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Neon top-border glow on hover */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${glowColor} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`absolute inset-x-0 top-0 h-6 bg-gradient-to-b ${glowColor.replace('via-', 'from-').replace('/80', '/8')} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Background glow orb */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glowColor.replace('via-', 'bg-').replace('/80', '/20')}`} />

      <div className="relative flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600 group-hover:text-zinc-500 transition-colors">
          {label}
        </span>
        <div className={`rounded-lg p-1.5 border border-white/6 bg-gradient-to-br ${gradient} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>

      <div className="relative flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums font-mono text-white/90">
          {displayed.toLocaleString()}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">
          {suffix}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-0.5 w-full bg-white/4 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000`}
          style={{ width: `${Math.min((value / Math.max(value, 100)) * 80 + 20, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Stats grid ───────────────────────────────────────── */
const STAT_CONFIG = [
  {
    label: 'Intelligence Depth',
    suffix: 'chunks',
    icon: (className: string) => <Layers3 className={className} />,
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    glowColor: 'via-emerald-500/80',
    iconClass: 'text-emerald-400',
    metricKey: 'indexed_chunks_count',
  },
  {
    label: 'Monitored Repos',
    suffix: 'repos',
    icon: (className: string) => <FolderGit2 className={className} />,
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    glowColor: 'via-indigo-400/80',
    iconClass: 'text-indigo-400',
    metricKey: 'repositories_count',
  },
  {
    label: 'AI Queries',
    suffix: 'queries',
    icon: (className: string) => <MessageSquare className={className} />,
    gradient: 'from-violet-500/20 to-violet-600/10',
    glowColor: 'via-violet-400/80',
    iconClass: 'text-violet-400',
    metricKey: 'chat_count',
  },
  {
    label: 'Active Projects',
    suffix: 'groups',
    icon: (className: string) => <Activity className={className} />,
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    glowColor: 'via-cyan-400/80',
    iconClass: 'text-cyan-400',
    metricKey: 'projects_count',
  },
] as const;

export function DashboardStatsGrid() {
  const { summary, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <Skeleton className="h-36 w-full rounded-3xl border border-white/6" />
    );
  }

  const metrics = summary?.metrics as Record<string, number> | undefined;
  const usage = summary?.usage;
  const queryUsed = usage?.usage_today?.queries ?? 0;
  const queryLimit = usage?.limits?.queries_per_day ?? 0;
  const queryPct = queryLimit > 0 ? Math.min(100, Math.round((queryUsed / queryLimit) * 100)) : 0;
  const planLabel = String(usage?.plan_tier || 'free').toUpperCase();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between rounded-2xl border border-white/8 bg-[hsl(240,18%,7%)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Plan</span>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
            {planLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="font-semibold text-zinc-200 tabular-nums">{queryUsed}</span>
          <span>/</span>
          <span className="tabular-nums">{queryLimit}</span>
          <span>queries today</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">{queryPct}%</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/6 shadow-premium">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
        {STAT_CONFIG.map((cfg, i) => (
          <StatCard
            key={cfg.label}
            label={cfg.label}
            value={metrics?.[cfg.metricKey] ?? 0}
            suffix={cfg.suffix}
            icon={cfg.icon(`h-4 w-4 ${cfg.iconClass}`)}
            gradient={cfg.gradient}
            glowColor={cfg.glowColor}
            delay={i * 80}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
