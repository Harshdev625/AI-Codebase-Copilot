'use client';

import * as React from 'react';
import { useDashboard } from '../hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderGit2, Layers3, Activity, MessageSquare } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Removed custom count-up hook in favor of framer-motion ── */

/* ── Single stat card ─────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  glowSoft: string;
  glowOrb: string;
  delay: number;
}

function StatCard({ label, value, suffix, icon, gradient, glow, glowSoft, glowOrb, delay }: StatCardProps) {
  const springValue = useSpring(0, { bounce: 0, duration: 1200 });
  
  React.useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  const displayValue = useTransform(springValue, (current) => Math.floor(current).toLocaleString());

  return (
    <div
      className="group relative flex flex-col gap-3 p-6 bg-card/80 transition-all duration-300 hover:bg-card overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Neon top-border glow on hover */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`absolute inset-x-0 top-0 h-6 bg-gradient-to-b ${glowSoft} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Background glow orb */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glowOrb}`} />

      <div className="relative flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground group-hover:text-foreground/70 transition-colors">
          {label}
        </span>
        <div className={`rounded-lg p-1.5 border border-white/6 bg-gradient-to-br ${gradient} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>

      <div className="relative flex items-baseline gap-2">
        <motion.span className="text-3xl font-semibold tracking-tight tabular-nums font-mono text-foreground">
          {displayValue}
        </motion.span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          {suffix}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-0.5 w-full bg-border/60 rounded-full overflow-hidden">
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
    gradient: 'from-success/30 to-success/10',
    glow: 'via-success/70',
    glowSoft: 'from-success/15',
    glowOrb: 'bg-success/20',
    iconClass: 'text-success',
    metricKey: 'indexed_chunks_count',
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
    metricKey: 'repositories_count',
  },
  {
    label: 'AI Queries',
    suffix: 'queries',
    icon: (className: string) => <MessageSquare className={className} />,
    gradient: 'from-ai/30 to-ai/10',
    glow: 'via-ai/70',
    glowSoft: 'from-ai/15',
    glowOrb: 'bg-ai/20',
    iconClass: 'text-ai',
    metricKey: 'chat_count',
  },
  {
    label: 'Active Projects',
    suffix: 'groups',
    icon: (className: string) => <Activity className={className} />,
    gradient: 'from-warning/30 to-warning/10',
    glow: 'via-warning/70',
    glowSoft: 'from-warning/15',
    glowOrb: 'bg-warning/20',
    iconClass: 'text-warning',
    metricKey: 'projects_count',
  },
] as const;

export function DashboardStatsGrid() {
  const { summary, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <Skeleton className="h-36 w-full rounded-3xl border border-border/60" />
    );
  }

  const metrics = summary?.metrics as Record<string, number> | undefined;
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 shadow-premium">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
        {STAT_CONFIG.map((cfg, i) => (
          <StatCard
            key={cfg.label}
            label={cfg.label}
            value={metrics?.[cfg.metricKey] ?? 0}
            suffix={cfg.suffix}
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
    </div>
  );
}
