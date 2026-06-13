import React from 'react';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { useIndexingJobs } from '@/features/repositories/hooks/use-repositories';
import {
  Activity,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  Search,
  FileCode,
  Database,
  Network,
  Loader2,
  LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

export function BackgroundTasksPanel() {
  const { selectedRepositoryId } = useStudioStore();
  const { data: jobs, isLoading } = useIndexingJobs(selectedRepositoryId || undefined);

  if (!selectedRepositoryId) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Select a repository to view its background tasks.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <Activity className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm">No background tasks found for this repository.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {jobs.map((job) => (
        <TaskCard key={job.id} job={job} />
      ))}
    </div>
  );
}

function formatStageDuration(seconds?: number) {
  if (seconds === undefined || seconds === null || seconds < 0) return null;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function liveStageElapsed(startedAt?: number) {
  if (!startedAt) return null;
  const elapsed = Math.max(0, Date.now() / 1000 - startedAt);
  return formatStageDuration(elapsed);
}

interface TaskCardProps {
  job: Record<string, unknown>;
  embedded?: boolean;
}

export function TaskCard({ job, embedded = false }: TaskCardProps) {
  const status = String(job.status ?? '').toLowerCase();
  const isRunning = isActiveIndexingStatus(status);
  const isFailed = status === 'failed' || status === 'error';
  const isSuccess = status === 'completed' || status === 'success';

  const stats = (job.stats ?? {}) as Record<string, unknown>;
  const progress = Math.min(100, Math.max(0, Number(stats.percentage) || 0));

  let currentStageId = String(stats.current_stage || 'queued').toLowerCase();
  if (currentStageId === 'storing') currentStageId = 'storage';
  if (currentStageId === 'embedding') currentStageId = 'storage';
  if (currentStageId === 'graph') currentStageId = 'finalize';

  const eta = stats.eta_seconds as number | undefined | null;

  let Icon = PlayCircle;
  let iconClass = 'text-primary';
  let bgClass = 'bg-primary/10';

  if (isSuccess) {
    Icon = CheckCircle2;
    iconClass = 'text-success';
    bgClass = 'bg-success/10';
  } else if (isFailed) {
    Icon = XCircle;
    iconClass = 'text-destructive';
    bgClass = 'bg-destructive/10';
  } else if (status === 'queued' || status === 'pending') {
    Icon = Clock;
    iconClass = 'text-muted-foreground';
    bgClass = 'bg-muted';
  } else if (isRunning) {
    Icon = Loader2;
    iconClass = 'text-primary animate-spin';
    bgClass = 'bg-primary/10';
  }

  const STAGES: { id: string; label: string; icon: LucideIcon }[] = [
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'parsing', label: 'Parsing & Chunking', icon: FileCode },
    { id: 'storage', label: 'Embedding & Storage', icon: Database },
    { id: 'finalize', label: 'Finalize', icon: Network },
  ];

  const stageTimings = (stats.stage_timings ?? {}) as Record<
    string,
    { duration_seconds?: number; started_at?: number }
  >;

  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStageId);

  const cardClass = embedded
    ? 'rounded-xl border border-border/50 bg-card/50 p-4 sm:p-5'
    : 'rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.2)] transition-colors hover:bg-card/60';

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bgClass}`}>
            <Icon className={`h-4 w-4 ${iconClass}`} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-2">
              {String(job.trigger_type || 'INDEXING PIPELINE')}
              <Badge
                variant={
                  isSuccess ? 'default' : isFailed ? 'destructive' : isRunning ? 'outline' : 'secondary'
                }
                className={
                  isRunning ? 'border-primary/50 text-primary text-[9px] uppercase tracking-wider px-2 py-0.5 h-5' : 'text-[9px] uppercase tracking-wider px-2 py-0.5 h-5'
                }
              >
                {status}
              </Badge>
            </h4>
            <span className="text-[11px] text-muted-foreground font-medium">
              {job.started_at
                ? formatDistanceToNow(new Date(String(job.started_at)), { addSuffix: true })
                : 'Waiting in queue…'}
            </span>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-end gap-3">
              <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase">
                Overall progress
                {eta !== undefined && eta !== null && (
                  <span className="ml-2 font-normal normal-case text-muted-foreground">
                    · ~{eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`} left
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-primary font-mono tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden border border-border/40">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="relative pt-2 pb-1">
            <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-border/50 rounded-full" />
            <div
              className="absolute top-5 left-[12.5%] h-0.5 bg-primary rounded-full transition-[width] duration-700 ease-linear"
              style={{
                width:
                  currentStageIndex >= 0
                    ? `${(Math.min(currentStageIndex, STAGES.length - 1) / (STAGES.length - 1)) * 75}%`
                    : '0%',
              }}
            />

            <div className="relative flex justify-between gap-2">
              {STAGES.map((stage, idx) => {
                const isCompleted = isSuccess || currentStageIndex > idx;
                const isActive = !isSuccess && currentStageIndex === idx;
                const isPending = !isSuccess && currentStageIndex < idx;
                const timing = stageTimings[stage.id];
                const stageDuration = isActive
                  ? liveStageElapsed(timing?.started_at) ?? 'Processing…'
                  : isCompleted
                    ? formatStageDuration(timing?.duration_seconds)
                    : null;

                return (
                  <div key={stage.id} className="flex flex-col items-center w-1/4 min-w-0">
                    <div
                      className={[
                        'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card',
                        isCompleted ? 'border-primary bg-primary text-primary-foreground' : '',
                        isActive ? 'border-primary text-primary' : '',
                        isPending ? 'border-border/60 text-muted-foreground' : '',
                      ].join(' ')}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <stage.icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={[
                        'mt-2 text-[9px] font-bold uppercase tracking-wider text-center leading-tight',
                        isCompleted ? 'text-foreground' : '',
                        isActive ? 'text-primary' : '',
                        isPending ? 'text-muted-foreground/60' : '',
                      ].join(' ')}
                    >
                      {stage.label}
                    </span>
                    {stageDuration ? (
                      <span
                        className={[
                          'mt-1 text-[9px] font-mono tabular-nums',
                          isActive ? 'text-primary' : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {stageDuration}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 flex items-center gap-2.5 min-h-[2.5rem]">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            <span
              className="text-[11px] text-muted-foreground font-mono truncate flex-1"
              title={String(stats.current_file || job.message || '')}
            >
              {String(stats.current_file || job.message || 'Initializing pipeline…')}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-border/40">
        {stats.processed_files !== undefined && (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Files processed
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-foreground text-sm tabular-nums">
                {Number(stats.processed_files).toLocaleString()}
              </span>
              <span className="text-muted-foreground text-[10px] font-medium tabular-nums">
                / {stats.total_files != null ? Number(stats.total_files).toLocaleString() : '?'}
              </span>
            </div>
          </div>
        )}

        {stats.files_skipped !== undefined && Number(stats.files_skipped) > 0 && (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Files skipped
            </span>
            <span className="font-semibold text-muted-foreground text-sm tabular-nums">
              {Number(stats.files_skipped).toLocaleString()}
            </span>
          </div>
        )}

        {stats.total_chunks !== undefined && (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Chunks gen
            </span>
            <span className="font-semibold text-foreground text-sm tabular-nums">
              {Number(stats.total_chunks).toLocaleString()}
            </span>
          </div>
        )}

        {stats.avg_seconds_per_file !== undefined && stats.avg_seconds_per_file !== null && (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Speed
            </span>
            <span className="font-semibold text-foreground text-sm tabular-nums">
              {String(stats.avg_seconds_per_file)}s{' '}
              <span className="text-[10px] text-muted-foreground font-medium">/ file</span>
            </span>
          </div>
        )}

        {stats.indexing_mode != null && String(stats.indexing_mode).length > 0 ? (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Mode
            </span>
            <span className="font-semibold text-foreground text-sm capitalize">
              {String(stats.indexing_mode)}
            </span>
          </div>
        ) : null}

        {(status === 'queued' || status === 'pending') && (
          <div className="flex flex-col rounded-lg border border-border/40 bg-background/40 p-3 md:col-span-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
              Queue state
            </span>
            <span className="font-semibold text-warning text-sm flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Waiting for available worker
            </span>
          </div>
        )}
      </div>

      {!isRunning && job.message != null && String(job.message).length > 0 ? (
        <div className="mt-4 text-[11px] text-muted-foreground bg-accent/10 p-3 rounded-lg border border-border/40 font-mono break-all leading-relaxed">
          {String(job.message)}
        </div>
      ) : null}
    </div>
  );
}
