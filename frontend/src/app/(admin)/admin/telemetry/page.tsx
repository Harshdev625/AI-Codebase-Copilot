'use client';

import * as React from 'react';
import {
  Activity,
  BarChart3,
  Gauge,
  Loader2,
  Radar,
  RefreshCw,
  Signal,
  Timer,
  Waves,
} from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/shared/toast-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type AdminTelemetry, toApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'cyan' | 'emerald' | 'amber' | 'violet';
}) {
  const accentMap = {
    cyan: 'from-cyan-500/30 via-cyan-400/20 to-transparent border-cyan-400/20',
    emerald: 'from-emerald-500/30 via-emerald-400/20 to-transparent border-emerald-400/20',
    amber: 'from-amber-500/30 via-amber-400/20 to-transparent border-amber-400/20',
    violet: 'from-violet-500/30 via-indigo-400/20 to-transparent border-violet-400/20',
  } as const;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4 sm:p-5 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30', accentMap[accent])} />
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/5 blur-2xl transition-opacity group-hover:opacity-80" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">{value}</p>
          <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200">{icon}</div>
      </div>
    </article>
  );
}

function MiniSeries({ values }: { values: number[] }) {
  const safeValues = values.length > 0 ? values : [0];
  const max = Math.max(...safeValues, 1);

  return (
    <div className="flex h-32 items-end gap-1.5 rounded-2xl border border-white/8 bg-[hsl(240,18%,6%)] p-3">
      {safeValues.map((v, index) => {
        const heightPct = Math.max(10, Math.round((v / max) * 100));
        return (
          <div key={`${index}-${v}`} className="group relative flex-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-cyan-500/70 via-cyan-400/70 to-cyan-200/80 transition-all duration-300 group-hover:from-cyan-400 group-hover:to-cyan-100"
              style={{ height: `${heightPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function PercentBar({ label, value, accent }: { label: string; value: number; accent: 'cyan' | 'emerald' | 'rose' }) {
  const width = Math.min(100, Math.max(0, value));
  const barColor =
    accent === 'cyan'
      ? 'from-cyan-500 to-blue-400'
      : accent === 'emerald'
        ? 'from-emerald-500 to-teal-400'
        : 'from-rose-500 to-red-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-400">{value.toFixed(2)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', barColor)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function AdminTelemetryPage(): React.JSX.Element {
  const toast = useToast();
  const [data, setData] = React.useState<AdminTelemetry | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTelemetry = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.admin.telemetry();
      setData(response);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error('Telemetry load failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Telemetry"
        description="Live operational pulse for streams, queue throughput, retrieval quality, and model latency."
        className="border-white/10"
        actions={
          <Button
            variant="glass"
            className="h-9 gap-2 border-cyan-400/20 text-cyan-200 hover:border-cyan-300/40"
            onClick={() => void loadTelemetry()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadTelemetry()} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-36 w-full rounded-2xl border border-white/10" />
            <Skeleton className="h-36 w-full rounded-2xl border border-white/10" />
            <Skeleton className="h-36 w-full rounded-2xl border border-white/10" />
            <Skeleton className="h-36 w-full rounded-2xl border border-white/10" />
          </>
        ) : (
          <>
            <MetricCard
              title="Active Streams"
              value={String(data?.active_streams ?? 0)}
              subtitle="Current live generation sessions"
              icon={<Waves className="h-4 w-4" />}
              accent="cyan"
            />
            <MetricCard
              title="Queue Depth"
              value={String(data?.indexing_queue_depth ?? 0)}
              subtitle="Pending indexing jobs"
              icon={<BarChart3 className="h-4 w-4" />}
              accent="emerald"
            />
            <MetricCard
              title="Running Jobs"
              value={String(data?.indexing_running ?? 0)}
              subtitle="Workers currently indexing"
              icon={<Activity className="h-4 w-4" />}
              accent="amber"
            />
            <MetricCard
              title="P95 Latency"
              value={`${Math.round(data?.model_latency.p95_ms ?? 0)} ms`}
              subtitle="Model response latency (24h)"
              icon={<Gauge className="h-4 w-4" />}
              accent="violet"
            />
          </>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-300">Latency Waveform</h3>
              <p className="mt-1 text-xs text-zinc-500">Recent model latency samples over 24h</p>
            </div>
            <Badge variant="ai" className="bg-cyan-500/10 text-cyan-300 border-cyan-400/30">Model Timing</Badge>
          </div>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl border border-white/10" />
          ) : (
            <MiniSeries values={data?.model_latency.samples_ms ?? []} />
          )}

          {!isLoading && data ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Average</p>
                <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{Math.round(data.model_latency.avg_ms)} ms</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">P50</p>
                <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{Math.round(data.model_latency.p50_ms)} ms</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">P95</p>
                <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{Math.round(data.model_latency.p95_ms)} ms</p>
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-300">Retrieval Hit Profile</h3>
              <p className="mt-1 text-xs text-zinc-500">Context retrieval effectiveness</p>
            </div>
            <Radar className="h-4 w-4 text-cyan-300" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              <PercentBar label="Top-1 Hit Rate" value={data?.retrieval_hit_profile.top1_hit_rate_pct ?? 0} accent="cyan" />
              <PercentBar label="Top-3 Hit Rate" value={data?.retrieval_hit_profile.top3_hit_rate_pct ?? 0} accent="emerald" />
              <PercentBar label="Zero-Hit Rate" value={data?.retrieval_hit_profile.zero_hit_rate_pct ?? 0} accent="rose" />

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Sample Size</p>
                <p className="mt-1 text-xl font-semibold text-zinc-100 tabular-nums">
                  {data?.retrieval_hit_profile.sample_size ?? 0}
                </p>
              </div>
            </div>
          )}
        </article>
      </section>

      {!isLoading && data ? (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <Signal className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.2em]">Queue Health</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-100 tabular-nums">
              {data.queue_health.failure_rate_pct.toFixed(2)}%
            </p>
            <p className="mt-1 text-xs text-zinc-500">Failure rate across {data.queue_health.total_jobs} jobs</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <Timer className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.2em]">Failed Jobs</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-100 tabular-nums">{data.queue_health.failed_jobs}</p>
            <p className="mt-1 text-xs text-zinc-500">Jobs requiring retry / investigation</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
            <div className="flex items-center gap-2 text-zinc-300">
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.2em]">Worker Throughput</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-100 tabular-nums">
              {data.indexing_running + data.indexing_queue_depth}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Running + queued indexing workload</p>
          </article>
        </section>
      ) : null}
    </div>
  );
}
