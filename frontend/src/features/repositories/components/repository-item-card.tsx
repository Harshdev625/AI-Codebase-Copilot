'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { repositoryService } from '../services/repository-service';
import { Repository } from '../types/repository-types';
import { useIndexRepository } from '../hooks/use-repositories';
import { Surface } from '@/components/ui/surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Globe, HardDrive, RefreshCw, Loader2, GitBranch, Zap, ExternalLink, Bot, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn, formatDate, truncate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RepositoryCardProps {
  repository: Repository;
}

function StatusBadge({ status, isIndexing }: { status: string; isIndexing: boolean }) {
  if (isIndexing) {
    return (
      <Badge variant="warning" className="gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Indexing
      </Badge>
    );
  }
  const s = status.toLowerCase();
  if (s === 'completed') return <Badge variant="success" className="gap-1"><CheckCircle className="h-2.5 w-2.5" />Ready</Badge>;
  if (s === 'failed') return <Badge variant="error" className="gap-1"><XCircle className="h-2.5 w-2.5" />Failed</Badge>;
  return <Badge variant="muted" className="gap-1"><Clock className="h-2.5 w-2.5" />{status || 'Not indexed'}</Badge>;
}

export function RepositoryItemCard({ repository }: RepositoryCardProps) {
  const indexMutation = useIndexRepository();
  const router = useRouter();
  const [progress, setProgress] = React.useState<{
    status: string;
    percentage: number;
    message: string;
    snapshotId?: string;
  } | null>(null);

  // Polling for indexing progress
  React.useEffect(() => {
    if (!progress?.snapshotId || ['completed', 'failed'].includes(progress.status.toLowerCase())) return;
    const interval = setInterval(async () => {
      try {
        const data = await repositoryService.getIndexProgress(progress.snapshotId!);
        setProgress({
          status: data.index_status,
          percentage: data.percentage,
          message: data.message,
          snapshotId: progress.snapshotId,
        });
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [progress?.snapshotId, progress?.status]);

  const handleIndex = () => {
    indexMutation.mutate({ repository_id: repository.id }, {
      onSuccess: (data) => {
        if (data.snapshot_id) {
          setProgress({ status: 'pending', percentage: 0, message: 'Queuing for indexing...', snapshotId: data.snapshot_id });
        }
      },
    });
  };

  const status = progress?.status || repository.latest_index_status || 'not indexed';
  const isIndexing = (progress && !['completed', 'failed'].includes(status.toLowerCase())) || indexMutation.isPending;
  const isReady = status.toLowerCase() === 'completed';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border/10 bg-card/20 transition-all duration-500',
        'hover:border-primary/20 hover:bg-card/40 hover:shadow-premium',
        isIndexing && 'border-warning/30 ring-1 ring-warning/5'
      )}
    >
      {/* Top: repo info */}
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-500',
              isReady
                ? 'bg-success/[0.03] border-success/20 group-hover:bg-success/10'
                : 'bg-muted/10 border-border/20 group-hover:bg-primary/[0.03] group-hover:border-primary/20'
            )}>
              {repository.remote_url
                ? <Globe className={cn('h-5 w-5 transition-colors', isReady ? 'text-success/60' : 'text-muted-foreground/30 group-hover:text-primary/60')} />
                : <HardDrive className={cn('h-5 w-5 transition-colors', isReady ? 'text-success/60' : 'text-muted-foreground/30 group-hover:text-primary/60')} />
              }
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold tracking-tight truncate group-hover:text-primary transition-colors">
                {repository.repo_id}
              </h3>
              <p className="text-[11px] text-muted-foreground/30 font-medium truncate mt-0.5 font-mono">
                {truncate(repository.remote_url || repository.local_path || '—', 38)}
              </p>
            </div>
          </div>
          <StatusBadge status={status} isIndexing={!!isIndexing} />
        </div>

        {/* Branch + version */}
        <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/5 border border-border/5">
            <GitBranch className="h-2.5 w-2.5" />
            {repository.default_branch}
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-2.5 w-2.5" />
            IDX-V{repository.indexing_version || 1}
          </span>
        </div>
      </div>

      {/* Bottom: actions / progress */}
      <div className="mt-auto px-6 pb-6 pt-2">
        <AnimatePresence mode="wait">
          {isIndexing ? (
            <motion.div
              key="indexing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3 pt-6 border-t border-border/10"
            >
              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2 text-warning animate-pulse">
                   {progress?.message || 'In-Synchronization'}
                </span>
                <span className="text-muted-foreground/40">{Math.round(progress?.percentage || 0)}%</span>
              </div>
              <Progress
                value={progress?.percentage || 0}
                variant="ai"
                size="sm"
                animated
              />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between pt-6 border-t border-border/10"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/20">
                {repository.updated_at || repository.created_at
                  ? `Last Node Sync: ${new Date(repository.updated_at || repository.created_at).toLocaleDateString()}`
                  : 'No Active Snapshots'}
              </p>
              <div className="flex items-center gap-2">
                {isReady && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground/30 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/10"
                    onClick={() => router.push('/chat')}
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border-border/20 bg-transparent',
                    isReady
                      ? 'hover:bg-primary hover:text-white hover:border-primary'
                      : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-white'
                  )}
                  onClick={handleIndex}
                  disabled={!!isIndexing}
                >
                  <Zap className="h-3 w-3 mr-2" />
                  {isReady ? 'Refresh' : 'Initialize'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Indexing gradient overlay */}
      {isIndexing && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-warning/[0.02] to-transparent" />
      )}
    </div>
  );
}
