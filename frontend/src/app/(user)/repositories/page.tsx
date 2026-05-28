'use client';

import * as React from 'react';
import { Loader2, RefreshCw, Search, Zap, CheckCircle2, Clock, AlertCircle, Plus, Trash2, Download, FileCode, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/shared/toast-provider';
import {
  useAddRepository,
  useIndexRepository,
  useRepositories,
} from '@/features/repositories/hooks/use-repositories';
import { repositoryService } from '@/features/repositories/services/repository-service';
import type { Repository } from '@/features/repositories/types/repository-types';
import { cn } from '@/lib/utils';

/** Indexing Stepper Component */
function IndexingStepper({ stage, percentage }: { stage?: string; percentage: number }) {
  const steps = [
    { id: 'prep', label: 'Preparation', stages: ['pending', 'cloning', 'file_discovery'], icon: Download },
    { id: 'chunk', label: 'Chunking', stages: ['chunking'], icon: FileCode },
    { id: 'embed', label: 'Embedding', stages: ['storage'], icon: Database },
  ];

  let activeIndex = 0;
  const currentStage = (stage || 'pending').toLowerCase();
  
  if (steps[1].stages.includes(currentStage)) activeIndex = 1;
  else if (steps[2].stages.includes(currentStage)) activeIndex = 2;
  else if (currentStage === 'completed') activeIndex = 3;

  return (
    <div className="flex items-center justify-between mt-3 mb-2">
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isCompleted = idx < activeIndex;
        const Icon = step.icon;
        
        return (
          <div key={step.id} className="flex flex-col items-center gap-1 relative z-10 flex-1">
            <div 
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card text-muted-foreground transition-colors",
                isActive && "border-primary text-primary bg-primary/10",
                isCompleted && "border-success text-success bg-success/10"
              )}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className={cn("h-3.5 w-3.5", isActive && "animate-pulse")} />}
            </div>
            <span className={cn(
              "text-[10px] font-medium text-center",
              (isActive || isCompleted) ? "text-foreground" : "text-muted-foreground/70"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Status badge component */
function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'completed') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" />
        Indexed
      </div>
    );
  }

  if (normalized === 'in_progress' || normalized === 'pending' || normalized === 'running') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3 animate-spin" />
        Indexing
      </div>
    );
  }

  if (normalized === 'failed') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="h-3 w-3" />
        Failed
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" />
      Pending
    </div>
  );
}

/** Repository card with indexing support */
function RepositoryCard({ repository, onRefresh }: { repository: Repository; onRefresh: () => void }) {
  const toast = useToast();
  const indexMutation = useIndexRepository();
  const [progress, setProgress] = React.useState<{
    percentage: number;
    status: string;
    message: string;
    indexingJobId: string;
    stats?: any;
  } | null>(null);

  const status = (progress?.status || repository.latest_job_status || repository.latest_index_status || 'not_indexed').toLowerCase();
  const isIndexing = status === 'pending' || status === 'running' || status === 'in_progress';
  const isReady = status === 'completed';

  React.useEffect(() => {
    if (!progress?.indexingJobId || !isIndexing) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const detail = await repositoryService.getIndexProgress(progress.indexingJobId);
        setProgress({
          indexingJobId: progress.indexingJobId,
          percentage: detail.percentage,
          status: detail.job_status,
          message: detail.message,
          stats: detail.stats,
        });

        if (detail.job_status === 'completed' || detail.job_status === 'failed') {
          clearInterval(timer);
          onRefresh();
        }
      } catch {
        clearInterval(timer);
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [progress?.indexingJobId, isIndexing, onRefresh]);

  const startIndexing = () => {
    indexMutation.mutate(
      { repository_id: repository.id },
      {
        onSuccess: (response) => {
          if (response.indexing_job_id) {
            setProgress({
              indexingJobId: response.indexing_job_id,
              percentage: 0,
              status: 'pending',
              message: 'Queued for indexing',
              stats: null,
            });
            toast.success('Indexing Started', 'Repository indexing has been queued.');
          }
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Indexing failed.';
          toast.error('Indexing Error', message);
        },
      }
    );
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 hover:bg-card/70 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{repository.repo_id}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {repository.remote_url || repository.local_path || 'No source configured'}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Repository details */}
      <div className="space-y-2 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Branch:</span>
          <span className="font-mono">{repository.default_branch}</span>
        </div>
        {repository.latest_indexed_chunks && (
          <div className="flex items-center gap-2">
            <span>Chunks:</span>
            <span>{repository.latest_indexed_chunks.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Indexing progress */}
      {progress && isIndexing && (
        <div className="mb-4 rounded-xl bg-card/60 border border-border/40 p-3">
          <IndexingStepper stage={progress.stats?.current_stage} percentage={progress.percentage} />
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
              <span className="truncate pr-2">{progress.message}</span>
              <span className="whitespace-nowrap">{Math.round(progress.percentage)}%</span>
            </div>
            <Progress value={progress.percentage} className="h-1.5" />
          </div>

          {progress.stats?.current_stage === 'storage' && progress.stats?.total_chunks > 0 && (
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/80 border-t border-border/40 pt-2">
              <div>
                Chunks: <span className="font-medium text-foreground">{progress.stats.stored_chunks}</span> of {progress.stats.total_chunks}
              </div>
              {progress.stats.eta_seconds > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>~{Math.ceil(progress.stats.eta_seconds / 60)} min left</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isReady && (
          <Button
            size="sm"
            onClick={startIndexing}
            disabled={isIndexing || indexMutation.isPending}
            className="flex-1 h-8"
          >
            {isIndexing ? (
              <>
                <Clock className="mr-1.5 h-3 w-3 animate-spin" />
                Indexing
              </>
            ) : (
              <>
                <Zap className="mr-1.5 h-3 w-3" />
                Index Now
              </>
            )}
          </Button>
        )}
        {isReady && (
          <Button
            size="sm"
            variant="outline"
            onClick={startIndexing}
            disabled={isIndexing || indexMutation.isPending}
            className="flex-1 h-8"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Re-Index
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function RepositoriesPage() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAddForm, setShowAddForm] = React.useState(false);
  const { repositories, isLoading, refetch } = useRepositories(100, 0);
  const addMutation = useAddRepository();
  const [repoInput, setRepoInput] = React.useState({ id: '', url: '', path: '' });

  const filteredRepos = React.useMemo(() => {
    if (!searchQuery) return repositories;
    const query = searchQuery.toLowerCase();
    return repositories.filter(
      (repo) =>
        repo.repo_id.toLowerCase().includes(query) ||
        (repo.remote_url?.toLowerCase().includes(query) ?? false) ||
        (repo.local_path?.toLowerCase().includes(query) ?? false)
    );
  }, [repositories, searchQuery]);

  const handleAddRepository = () => {
    if (!repoInput.id.trim()) {
      toast.error('Input Required', 'Please enter a repository identifier.');
      return;
    }
    if (!repoInput.url && !repoInput.path) {
      toast.error('Input Required', 'Please enter a repository URL or path.');
      return;
    }

    addMutation.mutate(
      {
        repo_id: repoInput.id,
        remote_url: repoInput.url || undefined,
        local_path: repoInput.path || undefined,
      },
      {
        onSuccess: () => {
          setRepoInput({ id: '', url: '', path: '' });
          setShowAddForm(false);
          toast.success('Repository Added', 'Your repository has been added successfully.');
          refetch();
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Failed to add repository.';
          toast.error('Add Failed', message);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Repositories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and index your code repositories for intelligent analysis.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-9 gap-1.5 shadow-glow-md w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Repository
        </Button>
      </div>

      {/* Add repository form */}
      {showAddForm && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Add New Repository</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Repository Identifier</label>
              <Input
                type="text"
                placeholder="my-app-backend"
                value={repoInput.id}
                onChange={(e) => setRepoInput({ ...repoInput, id: e.target.value })}
                className="mt-1 h-9"
              />
              <p className="mt-1 text-xs text-muted-foreground/70">A unique identifier for this repository (2-128 characters)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Repository URL</label>
              <Input
                type="url"
                placeholder="https://github.com/owner/repo.git"
                value={repoInput.url}
                onChange={(e) => setRepoInput({ ...repoInput, url: e.target.value })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Or Local Path</label>
              <Input
                type="text"
                placeholder="/path/to/repository"
                value={repoInput.path}
                onChange={(e) => setRepoInput({ ...repoInput, path: e.target.value })}
                className="mt-1 h-9"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAddRepository}
              disabled={addMutation.isPending}
              className="h-9"
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Adding
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-3 w-3" />
                  Add
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setRepoInput({ id: '', url: '', path: '' });
              }}
              className="h-9"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search bar */}
      {repositories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/30">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading repositories...</p>
          </div>
        </div>
      )}



      {/* Content */}
      {!isLoading && (
        <>
          {filteredRepos.length === 0 && repositories.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border border-border/40 bg-card/30 p-8 sm:p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-4">
                  <Plus className="h-6 w-6 text-primary/60" />
                </div>
              </div>
              <h3 className="font-semibold text-foreground">No repositories yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first repository to get started with AI-powered code analysis.
              </p>
              <Button className="mt-4 gap-1.5" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4" />
                Add Repository
              </Button>
            </div>
          ) : filteredRepos.length === 0 ? (
            /* No search results */
            <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No repositories match your search.</p>
            </div>
          ) : (
            /* Repositories grid */
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {filteredRepos.length} of {repositories.length} repositories
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRepos.map((repo) => (
                  <RepositoryCard key={repo.id} repository={repo} onRefresh={() => refetch()} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}