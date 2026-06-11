import React from 'react';
import { useRepositories, useRepositoryInsights, useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import { useWorkspaceStore } from '../store/workspace-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, GitBranch, GitCommit, FileCode2, Blocks, Camera, Activity, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { AddRepositoryDialog } from '@/features/repositories/components/add-repository-dialog';

export function RepositorySelector() {
  const { repositories, isLoading } = useRepositories(100, 0);
  const { selectedRepositoryId, setSelectedRepositoryId } = useWorkspaceStore();
  const selectedRepository = repositories.find((r) => r.id === selectedRepositoryId);
  const { data: insights } = useRepositoryInsights(selectedRepositoryId || '');
  const indexMutation = useIndexRepository();

  const handleValueChange = (repoId: string) => {
    setSelectedRepositoryId(repoId);
  };

  if (isLoading) {
    return <div className="p-4 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-3 border-b border-border/50 shrink-0 bg-surface flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={selectedRepositoryId || ''} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full text-sm font-semibold h-9 bg-background border-border shadow-sm">
            <SelectValue placeholder="Select a repository" />
          </SelectTrigger>
          <SelectContent>
            {repositories.map((repo) => (
              <SelectItem key={repo.id} value={repo.id} className="text-sm cursor-pointer">
                {repo.repo_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddRepositoryDialog />
      </div>
      
      {selectedRepository && (
        <div className="flex flex-col gap-2 text-xs text-muted-foreground px-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5" title="Active Branch">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{selectedRepository.default_branch || 'main'}</span>
            </div>
            {typeof selectedRepository.latest_job_stats?.commit_sha === 'string' && (
              <div className="flex items-center gap-1.5" title="Commit SHA">
                <GitCommit className="w-3.5 h-3.5" />
                <span>{selectedRepository.latest_job_stats.commit_sha.substring(0, 7)}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5" title="Files Indexed">
              <FileCode2 className="w-3.5 h-3.5" />
              <span>{insights?.files_indexed ?? '?'} files</span>
            </div>
            <div className="flex items-center gap-1.5" title="Total Chunks">
              <Blocks className="w-3.5 h-3.5" />
              <span>{typeof selectedRepository.latest_job_stats?.chunks_created === 'number' ? selectedRepository.latest_job_stats.chunks_created : '?'} chunks</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <Badge variant={selectedRepository.latest_job_status === 'completed' ? 'success' : selectedRepository.latest_job_status === 'failed' ? 'error' : 'warning'} className="text-[9px] px-1.5 py-0">
                  {selectedRepository.latest_job_status || 'idle'}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5" 
                title="Trigger Indexing"
                onClick={() => indexMutation.mutate({ repository_id: selectedRepository.id })}
                disabled={indexMutation.isPending || selectedRepository.latest_job_status === 'running' || selectedRepository.latest_job_status === 'queued'}
              >
                {indexMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <Play className="w-3 h-3 text-muted-foreground" />}
              </Button>
            </div>
            <span className="text-[10px] opacity-70">
              {selectedRepository.created_at ? formatDate(selectedRepository.created_at) : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
