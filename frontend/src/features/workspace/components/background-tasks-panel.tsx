import React from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { useIndexingJobs } from '@/features/repositories/hooks/use-repositories';
import { Activity, CheckCircle2, Clock, PlayCircle, AlertCircle, XCircle, Search, FileCode, Database, Network, LucideIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function BackgroundTasksPanel() {
  const { selectedRepositoryId } = useWorkspaceStore();
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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

export function TaskCard({ job }: { job: any }) {
  const isRunning = job.status === 'running' || job.status === 'in_progress' || job.status === 'queued';
  const isFailed = job.status === 'failed' || job.status === 'error';
  const isSuccess = job.status === 'completed' || job.status === 'success';

  const stats = job.stats || {};
  const progress = stats.percentage || 0;
  
  // Normalize the current stage to match our visual timeline
  let currentStageId = (stats.current_stage || 'queued').toLowerCase();
  // Map some known backend stage names to our visual steps
  if (currentStageId === 'storing') currentStageId = 'storage';
  if (currentStageId === 'embedding') currentStageId = 'storage'; // Often grouped
  
  const eta = stats.eta_seconds;

  let Icon = PlayCircle;
  let iconClass = "text-primary";
  let bgClass = "bg-primary/10";
  
  if (isSuccess) {
    Icon = CheckCircle2;
    iconClass = "text-success";
    bgClass = "bg-success/10";
  } else if (isFailed) {
    Icon = XCircle;
    iconClass = "text-destructive";
    bgClass = "bg-destructive/10";
  } else if (job.status === 'queued') {
    Icon = Clock;
    iconClass = "text-muted-foreground";
    bgClass = "bg-muted";
  } else if (isRunning) {
    Icon = Activity;
    iconClass = "text-primary animate-pulse";
    bgClass = "bg-primary/20";
  }

  // Visual Timeline Stages
  const STAGES: { id: string; label: string; icon: LucideIcon }[] = [
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'parsing', label: 'Parsing & Chunking', icon: FileCode },
    { id: 'storage', label: 'Embedding & Storage', icon: Database },
    { id: 'graph', label: 'Knowledge Graph', icon: Network }
  ];

  const currentStageIndex = STAGES.findIndex(s => s.id === currentStageId);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:bg-card/60 hover:shadow-[0_8px_32px_-12px_rgba(var(--primary),0.15)] group">
      
      {/* Background glow if running */}
      {isRunning && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none opacity-50 transition-opacity duration-1000" />
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bgClass} transition-colors`}>
            <Icon className={`h-4 w-4 ${iconClass}`} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-2">
              {job.trigger_type || 'INDEXING PIPELINE'}
              <Badge variant={isSuccess ? 'default' : isFailed ? 'destructive' : isRunning ? 'outline' : 'secondary'} 
                     className={`text-[9px] uppercase tracking-wider px-2 py-0.5 h-5 ${isRunning ? 'border-primary/50 text-primary animate-pulse' : ''}`}>
                {job.status}
              </Badge>
            </h4>
            <span className="text-[11px] text-muted-foreground font-medium">
              {job.started_at ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true }) : 'Waiting in queue...'}
            </span>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="relative space-y-7">
          
          {/* Main Progress Bar & ETA */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
                Overall Progress
                {eta !== undefined && eta !== null && (
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest animate-pulse">
                    ~ {eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`} Left
                  </span>
                )}
              </span>
              <span className="text-sm font-black text-primary font-mono">{progress}%</span>
            </div>
            <div className="h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/50">
              <div 
                className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer" />
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="relative pt-3 pb-2">
            {/* Connecting Line */}
            <div className="absolute top-5 left-[12.5%] right-[12.5%] h-[2px] bg-border/40 rounded-full" />
            <div 
              className="absolute top-5 left-[12.5%] h-[2px] bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(var(--primary),0.8)]" 
              style={{ width: currentStageIndex >= 0 ? `${(Math.min(currentStageIndex, STAGES.length - 1) / (STAGES.length - 1)) * 75}%` : '0%' }}
            />

            <div className="relative flex justify-between">
              {STAGES.map((stage, idx) => {
                const isCompleted = isSuccess || (currentStageIndex > idx);
                const isActive = !isSuccess && currentStageIndex === idx;
                const isPending = !isSuccess && currentStageIndex < idx;

                return (
                  <div key={stage.id} className="flex flex-col items-center w-1/4 z-10 group/stage">
                    <div 
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-card
                        ${isCompleted ? 'border-primary bg-primary text-primary-foreground scale-100' : ''}
                        ${isActive ? 'border-primary ring-4 ring-primary/20 scale-110 shadow-[0_0_12px_rgba(var(--primary),0.5)] text-primary' : ''}
                        ${isPending ? 'border-border/60 text-muted-foreground scale-90' : ''}
                      `}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <stage.icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`
                      mt-3 text-[9px] font-bold uppercase tracking-wider text-center transition-colors duration-300
                      ${isCompleted ? 'text-foreground' : ''}
                      ${isActive ? 'text-primary' : ''}
                      ${isPending ? 'text-muted-foreground/60' : ''}
                    `}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Action / File */}
          <div className="bg-background/40 rounded-xl p-3 border border-border/40 flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-[11px] text-muted-foreground font-mono truncate flex-1" title={stats.current_file || job.message || ''}>
              {stats.current_file || job.message || 'Initializing pipeline...'}
            </span>
          </div>
        </div>
      )}

      {/* Stats Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-7 pt-5 border-t border-border/40">
        {stats.processed_files !== undefined && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm transition-colors hover:bg-background/80">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Files Processed</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-foreground text-sm">{stats.processed_files.toLocaleString()}</span>
              <span className="text-muted-foreground text-[10px] font-medium">/ {stats.total_files?.toLocaleString() || '?'}</span>
            </div>
          </div>
        )}

        {stats.files_skipped !== undefined && stats.files_skipped > 0 && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm transition-colors hover:bg-background/80">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Files Skipped</span>
            <span className="font-black text-muted-foreground text-sm">{stats.files_skipped.toLocaleString()}</span>
          </div>
        )}
        
        {stats.total_chunks !== undefined && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm transition-colors hover:bg-background/80">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Chunks Gen</span>
            <span className="font-black text-foreground text-sm">{stats.total_chunks.toLocaleString()}</span>
          </div>
        )}

        {stats.avg_seconds_per_file !== undefined && stats.avg_seconds_per_file !== null && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm transition-colors hover:bg-background/80">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Speed</span>
            <span className="font-black text-foreground text-sm">{stats.avg_seconds_per_file}s <span className="text-[10px] text-muted-foreground font-medium">/ file</span></span>
          </div>
        )}

        {stats.indexing_mode && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm transition-colors hover:bg-background/80">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Mode</span>
            <span className="font-black text-foreground text-sm capitalize">{stats.indexing_mode}</span>
          </div>
        )}

        {job.status === 'queued' && (
          <div className="flex flex-col bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm md:col-span-2">
            <span className="text-muted-foreground uppercase tracking-widest text-[9px] mb-1.5 font-semibold">Queue State</span>
            <span className="font-black text-warning text-sm flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              Waiting for available worker
            </span>
          </div>
        )}
      </div>

      {!isRunning && job.message && (
        <div className="mt-4 text-[11px] text-muted-foreground bg-accent/10 p-3 rounded-xl border border-border/40 font-mono break-all leading-relaxed">
          {job.message}
        </div>
      )}
    </div>
  );
}
