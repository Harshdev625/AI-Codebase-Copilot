'use client';

import * as React from 'react';
import {
  Activity,
  Camera,
  Database,
  FileText,
  GitPullRequestDraft,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_EYEBROW } from '@/components/layout/nav-tokens';
import type { SystemMetrics } from '@/features/admin/services/admin-service';

function MetricCard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/40 bg-card/60 p-4 shadow-2xl backdrop-blur-xl transition-all hover:border-primary/50 xl:p-5">
      <div className="absolute inset-x-0 -bottom-px h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <p className={DASHBOARD_EYEBROW}>{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] transition-transform duration-500 group-hover:scale-110 xl:h-10 xl:w-10">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground lg:text-3xl xl:text-4xl">
        {value}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground xl:text-sm">{subtitle}</p>}
    </div>
  );
}

interface AdminMetricsGridProps {
  metrics?: SystemMetrics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function AdminMetricsGrid({ metrics, isLoading, isError, onRetry }: AdminMetricsGridProps) {
  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Failed to load platform metrics</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Try again
          </button>
        )}
      </div>
    );
  }

  const files = metrics?.indexed_files_count ?? 0;
  const chunks = metrics?.indexed_chunks_count ?? 0;
  const patches = metrics?.patch_count ?? 0;
  const snapshots = metrics?.snapshot_count ?? 0;

  const items = [
    { label: 'Users', value: metrics?.users_count ?? 0, icon: <Users className="h-4 w-4 xl:h-5 xl:w-5" /> },
    { label: 'Repositories', value: metrics?.repositories_count ?? 0, icon: <Database className="h-4 w-4 xl:h-5 xl:w-5" /> },
    {
      label: 'Indexed Files',
      value: files,
      subtitle: chunks > 0 ? `${(chunks / Math.max(files, 1)).toFixed(1)} chunks/file` : undefined,
      icon: <FileText className="h-4 w-4 xl:h-5 xl:w-5" />,
    },
    { label: 'Chunks', value: chunks, icon: <Activity className="h-4 w-4 xl:h-5 xl:w-5" /> },
    { label: 'Sessions', value: metrics?.active_sessions ?? 0, icon: <MessageSquare className="h-4 w-4 xl:h-5 xl:w-5" /> },
    {
      label: 'Patches',
      value: patches,
      subtitle: snapshots > 0 ? `${patches} patches · ${snapshots} snapshots` : undefined,
      icon: <GitPullRequestDraft className="h-4 w-4 xl:h-5 xl:w-5" />,
    },
    { label: 'Snapshots', value: snapshots, icon: <Camera className="h-4 w-4 xl:h-5 xl:w-5" /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </div>
  );
}
