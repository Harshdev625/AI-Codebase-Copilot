'use client';

import * as React from 'react';
import { useAddRepository } from '../hooks/use-repositories';
import { GitBranch, Globe, HardDrive, Plus, Loader2, Info, Sparkles } from 'lucide-react';
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
    if (!projectId || !repoId.trim()) return;
    const isLocal = sourceType === 'local';
    addRepoMutation.mutate({
      projectId,
      payload: {
        repo_id: repoId.trim().toLowerCase().replace(/\.git$/, ''),
        remote_url: isLocal ? undefined : source.trim() || undefined,
        local_path: isLocal ? source.trim() : undefined,
        default_branch: defaultBranch.trim() || 'main',
      },
    }, {
      onSuccess: () => { setRepoId(''); setSource(''); setDefaultBranch('main'); },
    });
  };

  const sourceIcon =
    sourceType === 'local'  ? <HardDrive className="h-4 w-4 text-amber-400" /> :
    sourceType === 'github' ? <Globe     className="h-4 w-4 text-violet-400" /> :
                              <Globe     className="h-4 w-4 text-zinc-700"   />;

  const isFormValid = !!repoId.trim() && !!projectId;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl border transition-opacity shadow-premium',
      projectId
        ? 'border-white/8 bg-[hsl(240,18%,7%)]'
        : 'border-dashed border-white/5 bg-[hsl(240,18%,6%)] opacity-60 grayscale-[0.5]'
    )}>
      {/* Top gradient line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-gradient-to-r from-violet-500/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/20">
            <Plus className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-[12px] font-bold text-white/80 tracking-tight">
            {projectId ? 'Connect Repository' : 'Select a Project First'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-violet-400 transition-colors"
        >
          <Info className="h-3 w-3" />
          Guide
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="px-5 py-3.5 border-b border-violet-500/10 bg-violet-500/4 text-[11px] text-zinc-500 space-y-1.5 animate-fade-in">
          <p className="flex items-start gap-2">
            <Sparkles className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
            <span><span className="font-bold text-violet-300">Repo ID:</span> A unique slug like <code className="bg-white/5 px-1 rounded text-violet-300">owner/repo-name</code></span>
          </p>
          <p className="flex items-start gap-2">
            <Sparkles className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
            <span><span className="font-bold text-indigo-300">Source:</span> GitHub URL like <code className="bg-white/5 px-1 rounded text-zinc-400">https://github.com/org/repo</code> or local path</span>
          </p>
          <p className="flex items-start gap-2">
            <Sparkles className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
            <span><span className="font-bold text-emerald-300">Branch:</span> Branch to index, typically <code className="bg-white/5 px-1 rounded text-zinc-400">main</code></span>
          </p>
        </div>
      )}

      {/* Form fields */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Repo ID */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 border border-violet-500/15 shrink-0">
              <span className="text-[8px] font-bold text-violet-400">ID</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-zinc-700 mb-1">Repo ID *</div>
              <Input
                placeholder="owner/repo-name"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-[13px] font-medium placeholder:text-zinc-700 text-zinc-300 disabled:opacity-50"
                required
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="shrink-0">{sourceIcon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-zinc-700">Source URL / Path</div>
                {sourceType !== 'none' && (
                  <span className={cn(
                    'text-[7px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5',
                    sourceType === 'github' ? 'bg-violet-500/10 text-violet-400' :
                    sourceType === 'local'  ? 'bg-amber-500/10 text-amber-400' :
                    'bg-white/5 text-zinc-600'
                  )}>
                    {sourceType}
                  </span>
                )}
              </div>
              <Input
                placeholder="https://github.com/org/repo or /path/to/repo"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-[13px] font-medium placeholder:text-zinc-700 text-zinc-300 disabled:opacity-50"
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <GitBranch className="h-4 w-4 text-zinc-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-zinc-700 mb-1">Branch</div>
              <Input
                placeholder="main"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="h-7 border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-[13px] font-medium placeholder:text-zinc-700 text-zinc-300 disabled:opacity-50"
                disabled={!projectId}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end px-4 py-3.5 bg-white/2">
            <Button
              type="submit"
              size="sm"
              disabled={addRepoMutation.isPending || !isFormValid}
              className="h-9 px-5 font-bold text-[10px] uppercase tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-glow-sm hover:shadow-glow-md gap-2 transition-all"
            >
              {addRepoMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Plus className="h-3.5 w-3.5" />
              }
              Add Source
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
