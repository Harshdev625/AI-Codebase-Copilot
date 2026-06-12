'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useDashboard } from '../hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderGit2, Layers3, Activity, MessageSquare } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  suffix: string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  glowSoft: string;
  glowOrb: string;
  delay: number;
}

function StatCard({ label, value, suffix, subtitle, icon, gradient, glow, glowSoft, glowOrb, delay }: StatCardProps) {
  const springValue = useSpring(0, { bounce: 0, duration: 1200 });

  React.useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  const displayValue = useTransform(springValue, (current) => Math.floor(current).toLocaleString());

  return (
    <div
      className="group relative flex flex-col gap-3 overflow-hidden bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:bg-card/80"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${glow} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div
        className={`absolute inset-x-0 top-0 h-6 bg-gradient-to-b ${glowSoft} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-[30px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${glowOrb}`}
      />

      <div className="relative flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground transition-colors group-hover:text-foreground/70 lg:text-[10px]">
          {label}
        </span>
        <div
          className={cn(
            'rounded-lg border border-white/6 bg-gradient-to-br p-1.5 shadow-sm transition-transform duration-300 group-hover:scale-110',
            gradient
          )}
        >
          {icon}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-baseline gap-2">
          <motion.span className="text-3xl font-semibold tracking-tight tabular-nums font-mono text-foreground lg:text-4xl">
            {displayValue}
          </motion.span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground lg:text-[10px]">
            {suffix}
          </span>
        </div>
        {subtitle && (
          <p className="mt-2 text-xs leading-snug text-muted-foreground lg:text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

const STAT_CONFIG = [
  {
    label: 'Intelligence Depth',
    suffix: 'chunks',
    icon: (className: string) => <Layers3 className={className} />,
    gradient: 'from-success/30 to-success/10',
    glow: 'via-success/70',
    glowSoft: 'from-success/15',
    glowOrb: 'bg-success/20',
    iconClass: 'text-success',
    metricKey: 'indexed_chunks_count' as const,
  },
  {
    label: 'Monitored Repos',
    suffix: 'repos',
    icon: (className: string) => <FolderGit2 className={className} />,
    gradient: 'from-primary/30 to-primary/10',
    glow: 'via-primary/70',
    glowSoft: 'from-primary/15',
    glowOrb: 'bg-primary/20',
    iconClass: 'text-primary',
    metricKey: 'repositories_count' as const,
  },
  {
    label: 'AI Queries',
    suffix: 'sessions',
    icon: (className: string) => <MessageSquare className={className} />,
    gradient: 'from-ai/30 to-ai/10',
    glow: 'via-ai/70',
    glowSoft: 'from-ai/15',
    glowOrb: 'bg-ai/20',
    iconClass: 'text-ai',
    metricKey: 'chat_count' as const,
  },
  {
    label: 'Active Indexing',
    suffix: 'jobs',
    icon: (className: string) => <Activity className={className} />,
    gradient: 'from-warning/30 to-warning/10',
    glow: 'via-warning/70',
    glowSoft: 'from-warning/15',
    glowOrb: 'bg-warning/20',
    iconClass: 'text-warning',
    metricKey: 'active_indexing_jobs' as const,
  },
] as const;

function buildSubtitle(
  key: (typeof STAT_CONFIG)[number]['metricKey'],
  metrics: Record<string, number | undefined>,
  indexingSummary?: { ready: number; indexing: number; failed: number; idle: number },
  lastActivityAt?: string | null
): string {
  switch (key) {
    case 'indexed_chunks_count': {
      const files = metrics.indexed_files_count ?? 0;
      return files > 0 ? `${files.toLocaleString()} files indexed` : 'No files indexed yet';
    }
    case 'repositories_count': {
      if (!indexingSummary) return 'Repository health unknown';
      return `${indexingSummary.ready} ready · ${indexingSummary.indexing} indexing`;
    }
    case 'chat_count': {
      if (!lastActivityAt) return 'No recent activity';
      try {
        return `Last active ${formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true })}`;
      } catch {
        return 'Recent activity available';
      }
    }
    case 'active_indexing_jobs': {
      const active = metrics.active_indexing_jobs ?? 0;
      return active > 0 ? `${active} job${active === 1 ? '' : 's'} in progress` : 'All repositories up to date';
    }
    default:
      return '';
  }
}

export function DashboardStatsGrid() {
  const { summary, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return <Skeleton className="h-36 w-full rounded-3xl border border-border/60" />;
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center backdrop-blur-xl">
        <p className="text-sm font-medium text-destructive">Failed to load dashboard metrics</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 text-sm font-semibold text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const metrics = summary?.metrics ?? {};
  const metricRecord = metrics as Record<string, number | undefined>;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 shadow-premium">
      <div className="grid grid-cols-1 divide-y divide-border/40 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {STAT_CONFIG.map((cfg, i) => (
          <StatCard
            key={cfg.label}
            label={cfg.label}
            value={metricRecord[cfg.metricKey] ?? 0}
            suffix={cfg.suffix}
            subtitle={buildSubtitle(
              cfg.metricKey,
              metricRecord,
              summary?.indexing_summary,
              metrics.last_activity_at
            )}
            icon={cfg.icon(`h-4 w-4 ${cfg.iconClass}`)}
            gradient={cfg.gradient}
            glow={cfg.glow}
            glowSoft={cfg.glowSoft}
            glowOrb={cfg.glowOrb}
            delay={i * 80}
          />
        ))}
      </div>
    </div>
  );
}
