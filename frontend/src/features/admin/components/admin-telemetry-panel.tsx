'use client';

import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { TelemetryResponse } from '@/features/admin/services/admin-service';

interface AdminTelemetryPanelProps {
  telemetry?: TelemetryResponse;
  isLoading?: boolean;
  lastRefreshedAt?: number;
  onFailedJobsClick?: () => void;
}

function formatHitRate(value: number | undefined, sampleSize: number | undefined): string {
  if (!sampleSize || sampleSize <= 0) {
    return 'Collecting samples…';
  }
  return `${value?.toFixed(1) ?? 0}%`;
}

export function AdminTelemetryPanel({
  telemetry,
  isLoading,
  lastRefreshedAt,
  onFailedJobsClick,
}: AdminTelemetryPanelProps) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const hit = telemetry?.retrieval_hit_profile;
  const latency = telemetry?.model_latency;
  const queue = telemetry?.queue_health;
  const sampleSize = hit?.sample_size ?? 0;
  const failedJobs = queue?.failed_jobs ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-2xl backdrop-blur-xl xl:col-span-8 xl:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground xl:text-base">
        <Activity className="h-4 w-4 text-primary" />
        Worker & Retrieval Telemetry
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <TelemetryCell label="Streams" value={telemetry?.active_streams ?? 0} />
        <TelemetryCell label="Workers" value={telemetry?.indexing_running ?? 0} accent="primary" />
        <TelemetryCell label="Queue" value={telemetry?.indexing_queue_depth ?? 0} accent="warning" />
        <TelemetryCell
          label="Failed jobs"
          value={failedJobs}
          accent="destructive"
          onClick={failedJobs > 0 ? onFailedJobsClick : undefined}
        />
        <TelemetryCell label="Failure rate" value={`${queue?.failure_rate_pct?.toFixed(1) ?? 0}%`} />
        <TelemetryCell label="P95 latency" value={`${latency?.p95_ms ?? 0}ms`} />
        <TelemetryCell
          label="Top-1 hit rate"
          value={formatHitRate(hit?.top1_hit_rate_pct, sampleSize)}
          hint={sampleSize > 0 ? `n=${sampleSize}` : undefined}
        />
        <TelemetryCell
          label="Top-3 hit rate"
          value={formatHitRate(hit?.top3_hit_rate_pct, sampleSize)}
          hint={sampleSize > 0 ? `n=${sampleSize}` : undefined}
        />
        <TelemetryCell
          label="Zero-hit rate"
          value={formatHitRate(hit?.zero_hit_rate_pct, sampleSize)}
          hint={sampleSize > 0 ? `n=${sampleSize}` : undefined}
        />
      </div>
      {lastRefreshedAt && (
        <p className="text-xs text-muted-foreground xl:text-sm">
          Last refreshed{' '}
          {formatDistanceToNow(new Date(lastRefreshedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function TelemetryCell({
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'primary' | 'warning' | 'destructive';
  onClick?: () => void;
}) {
  const accentClass =
    accent === 'primary'
      ? 'border-primary/20 bg-primary/10 text-primary'
      : accent === 'warning'
        ? 'border-warning/20 bg-warning/10 text-warning'
        : accent === 'destructive'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-border/40 bg-muted/30 text-foreground';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${accentClass} ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
    >
      <div className="mb-1 text-xs font-bold uppercase tracking-widest opacity-80 xl:text-sm">{label}</div>
      <div className="text-lg font-bold tabular-nums lg:text-xl xl:text-2xl">{value}</div>
      {hint && <div className="mt-0.5 text-xs opacity-70">{hint}</div>}
    </Wrapper>
  );
}
