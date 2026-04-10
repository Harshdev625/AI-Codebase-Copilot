'use client';

import * as React from 'react';
import { useAddRepository } from '../hooks/use-repositories';
import { GitBranch, Globe, HardDrive, Plus, Loader2, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddRepositoryFormProps {
  projectId: string;
}

function detectSourceType(source: string): 'local' | 'github' | 'remote' | 'none' {
  if (!source) return 'none';
  if (source.includes('/') && !source.startsWith('http')) return 'local';
  if (source.includes('github.com')) return 'github';
  return 'remote';
}

export function RepositoryAddForm({ projectId }: AddRepositoryFormProps) {
  const addRepoMutation = useAddRepository();
  const [repoId, setRepoId] = React.useState('');
  const [source, setSource] = React.useState('');
  const [defaultBranch, setDefaultBranch] = React.useState('main');
  const [showHelp, setShowHelp] = React.useState(false);

  const sourceType = detectSourceType(source);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      console.error('No project selected for repository addition');
      return;
    }
    if (!repoId.trim()) return;

    const isLocal = sourceType === 'local';
    const payload = {
      repo_id: repoId.trim().toLowerCase().replace(/\.git$/, ''),
      remote_url: isLocal ? undefined : source.trim() || undefined,
      local_path: isLocal ? source.trim() : undefined,
      default_branch: defaultBranch.trim() || 'main',
    };

    addRepoMutation.mutate({ projectId, payload }, {
      onSuccess: () => {
        setRepoId('');
        setSource('');
        setDefaultBranch('main');
      },
    });
  };

  const sourceIcon = sourceType === 'local'
    ? <HardDrive className="h-4 w-4 text-amber-500" />
    : sourceType === 'github'
    ? <Globe className="h-4 w-4 text-primary" />
    : <Globe className="h-4 w-4 text-muted-foreground/40" />;

  const isFormValid = !!repoId.trim() && !!projectId;

  return (
    <div className={cn(
      "rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm transition-opacity",
      !projectId && "opacity-60 grayscale-[0.5]"
    )}>
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Plus className={cn("h-4 w-4", projectId ? "text-primary" : "text-muted-foreground")} />
          <span className="text-sm font-bold tracking-tight">
            {projectId ? "Connect Repository" : "Select a Project First"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors"
        >
          <Info className="h-3 w-3" />
          Help
        </button>
      </div>

      {/* Help tooltip */}
      {showHelp && (
        <div className="px-5 py-3 bg-primary/4 border-b border-primary/10 text-[11px] text-muted-foreground space-y-1 animate-fade-in">
          <p><span className="font-bold text-primary">Repo ID:</span> A unique slug, e.g. <code className="bg-muted px-1 rounded">owner/repo-name</code></p>
          <p><span className="font-bold text-primary">Source:</span> GitHub URL like <code className="bg-muted px-1 rounded">https://github.com/org/repo</code> or a local path like <code className="bg-muted px-1 rounded">C:/projects/myapp</code></p>
          <p><span className="font-bold text-primary">Branch:</span> The branch to index, typically <code className="bg-muted px-1 rounded">main</code> or <code className="bg-muted px-1 rounded">master</code></p>
        </div>
      )}

      {/* Form fields */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] divide-y md:divide-y-0 md:divide-x divide-border/20">
          {/* Repo ID */}
          <div className="flex items-center gap-3 px-4 py-3">
            <ChevronRight className="h-4 w-4 text-primary/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Repo ID *</div>
              <Input
                placeholder="owner/repo-name"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-sm font-medium placeholder:text-muted-foreground/30 disabled:opacity-50"
                required
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="shrink-0">{sourceIcon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Source URL / Path</div>
                {sourceType !== 'none' && (
                  <span className={cn(
                    'text-[8px] font-bold uppercase tracking-widest rounded-full px-1.5 py-0.5',
                    sourceType === 'github' ? 'bg-primary/10 text-primary' :
                    sourceType === 'local' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {sourceType}
                  </span>
                )}
              </div>
              <Input
                placeholder="https://github.com/org/repo or /path/to/repo"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-sm font-medium placeholder:text-muted-foreground/30 disabled:opacity-50"
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-3 px-4 py-3">
            <GitBranch className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Branch</div>
              <Input
                placeholder="main"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-sm font-medium placeholder:text-muted-foreground/30 disabled:opacity-50"
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end px-4 py-3 bg-muted/20">
            <Button
              type="submit"
              size="sm"
              disabled={addRepoMutation.isPending || !isFormValid}
              className="h-9 px-5 font-bold shadow-sm shadow-primary/20"
            >
              {addRepoMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-2" />
              )}
              Add Source
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

