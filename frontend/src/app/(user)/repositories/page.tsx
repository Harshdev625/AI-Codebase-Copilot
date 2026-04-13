'use client';

import * as React from 'react';
import {
  LayoutGrid, List, RefreshCw, Plus, GitBranch, Database,
  FolderKanban, Globe, HardDrive, Zap, Focus,
  CheckCircle, XCircle, Clock, Loader2, Bot, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepositories, useProjects, useCreateProject, useAddRepository, useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import { Repository, Project } from '@/features/repositories/types/repository-types';
import { repositoryService } from '@/features/repositories/services/repository-service';
import { cn, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

/* ══════════════════════════════════════════════════════
   COMPACT PROJECT TABS
══════════════════════════════════════════════════════ */
function ProjectTabs({
  projects, selectedId, onSelect, isLoading, onCreate,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full bg-white/5" />)
      ) : (
        projects.map((p) => {
          const active = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                'group relative flex items-center gap-2 h-8 px-4 rounded-full border text-[12px] font-semibold transition-all duration-300 snap-start shrink-0',
                active
                  ? 'bg-violet-500/15 border-violet-500/40 text-white shadow-[0_0_15px_-5px_hsl(265,80%,65%,0.3)]'
                  : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:bg-white/[0.05] hover:border-white/20 hover:text-white'
              )}
            >
              <FolderKanban className={cn('h-3.5 w-3.5 transition-colors', active ? 'text-violet-400' : 'text-zinc-500 group-hover:text-zinc-300')} />
              <span className="max-w-[120px] truncate">{p.name}</span>
              {active && (
                <motion.div layoutId="activeProject" className="absolute inset-0 rounded-full border border-violet-400/50" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              )}
            </button>
          );
        })
      )}
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 h-8 px-4 rounded-full border border-dashed border-white/15 text-[11px] font-bold text-zinc-400 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all duration-300 shrink-0 snap-start"
      >
        <Plus className="h-3.5 w-3.5" />
        New
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   NEW PROJECT FORM (Compact)
══════════════════════════════════════════════════════ */
function NewProjectInlineForm({ onDone }: { onDone: () => void }) {
  const createMutation = useCreateProject();
  const [name, setName] = React.useState('');
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim() }, { onSuccess: onDone });
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={submit}
      className="overflow-hidden mb-4"
    >
      <div className="flex items-center gap-2 p-2 rounded-xl border border-violet-500/30 bg-[linear-gradient(90deg,hsl(246,80%,6%),hsl(246,80%,4%))] shadow-[0_4px_15px_rgba(139,92,246,0.1)]">
        <Focus className="h-4 w-4 ml-2 text-violet-400 animate-pulse" />
        <Input
          ref={ref}
          placeholder="Workspace name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 border-none bg-transparent text-[13px] text-white placeholder:text-violet-200/40 focus-visible:ring-0 p-0 font-medium"
        />
        <Button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          className="h-8 px-4 rounded-lg text-[11px] font-bold bg-white text-black hover:bg-zinc-200"
        >
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Launch'}
        </Button>
        <button type="button" onClick={onDone} className="h-8 px-3 text-[11px] font-bold text-zinc-400 hover:text-white">
          Cancel
        </button>
      </div>
    </motion.form>
  );
}

/* ══════════════════════════════════════════════════════
   ADD REPOSITORY FORM (Dense Row)
══════════════════════════════════════════════════════ */
function detectType(source: string): 'local' | 'github' | 'remote' | '' {
  if (!source) return '';
  if (!source.startsWith('http') && source.includes('/')) return 'local';
  if (source.includes('github.com')) return 'github';
  return 'remote';
}

function AddRepoForm({ projectId }: { projectId: string }) {
  const mutation = useAddRepository();
  const [repoId, setRepoId] = React.useState('');
  const [source, setSource] = React.useState('');
  const [branch, setBranch] = React.useState('main');
  const type = detectType(source);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !repoId.trim()) return;
    mutation.mutate({
      projectId,
      payload: {
        repo_id: repoId.trim().toLowerCase().replace(/\.git$/, ''),
        remote_url: type !== 'local' && source ? source.trim() : undefined,
        local_path: type === 'local' ? source.trim() : undefined,
        default_branch: branch.trim() || 'main',
      },
    }, {
      onSuccess: () => { setRepoId(''); setSource(''); setBranch('main'); },
    });
  };

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-300 shadow-sm overflow-hidden',
      projectId ? 'border-white/10 bg-[#0A0A0B]' : 'border-white/5 bg-black/20 opacity-50 pointer-events-none'
    )}>
      <form onSubmit={submit} className="flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-white/10">
        
        {/* Repo ID */}
        <div className="flex-1 flex items-center px-4 py-2 bg-white/[0.01] focus-within:bg-white/[0.03] w-full">
          <Search className="h-3.5 w-3.5 text-violet-400 shrink-0 mr-2" />
          <Input
            placeholder="Repository ID (e.g. core-engine)"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-[13px] text-white focus-visible:ring-0"
            required disabled={!projectId}
          />
        </div>

        {/* Source */}
        <div className="flex-[1.5] w-full flex items-center px-4 py-2 bg-white/[0.01] focus-within:bg-white/[0.03]">
          {type === 'local' ? <HardDrive className="h-3.5 w-3.5 text-amber-500 mr-2 shrink-0" /> :
           type === 'github' ? <Globe className="h-3.5 w-3.5 text-indigo-400 mr-2 shrink-0" /> :
           <Globe className="h-3.5 w-3.5 text-zinc-500 mr-2 shrink-0" />}
          <Input
            placeholder="URL (https://github...) or Path (C:\...)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-[13px] text-white focus-visible:ring-0"
            disabled={!projectId}
          />
        </div>

        {/* Branch */}
        <div className="w-full md:w-[130px] flex items-center px-4 py-2 bg-white/[0.01] focus-within:bg-white/[0.03]">
          <GitBranch className="h-3.5 w-3.5 text-zinc-500 mr-2 shrink-0" />
          <Input
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-[13px] text-white focus-visible:ring-0"
            disabled={!projectId}
          />
        </div>

        {/* Submit */}
        <div className="w-full md:w-[120px] p-2 bg-black/20">
          <Button
            type="submit"
            disabled={mutation.isPending || !repoId.trim() || !projectId}
            className="w-full h-8 rounded-lg text-[11px] font-bold tracking-wide bg-white text-black hover:bg-zinc-200 border-0 disabled:opacity-30"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Connect'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   REPOSITORY CARD (Dense Profile)
══════════════════════════════════════════════════════ */
function RepoCard({ repository, forceListMode = false }: { repository: Repository, forceListMode?: boolean }) {
  const indexMutation = useIndexRepository();
  const router = useRouter();
  const [progress, setProgress] = React.useState<{
    status: string; percentage: number; message: string; snapshotId?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!progress?.snapshotId || ['completed', 'failed'].includes(progress.status.toLowerCase())) return;
    const id = setInterval(async () => {
      try {
        const d = await repositoryService.getIndexProgress(progress.snapshotId!);
        setProgress({ status: d.index_status, percentage: d.percentage, message: d.message, snapshotId: progress.snapshotId });
      } catch { clearInterval(id); }
    }, 2000);
    return () => clearInterval(id);
  }, [progress?.snapshotId, progress?.status]);

  const status = progress?.status || repository.latest_index_status || 'not_indexed';
  const statusLower = status.toLowerCase();
  const isIndexing = (progress && !['completed', 'failed'].includes(statusLower)) || indexMutation.isPending;
  const isReady = statusLower === 'completed';
  const isFailed = statusLower === 'failed';

  const handleIndex = () => {
    indexMutation.mutate({ repository_id: repository.id }, {
      onSuccess: (data) => {
        if (data.snapshot_id) {
          setProgress({ status: 'pending', percentage: 0, message: 'Warming engines…', snapshotId: data.snapshot_id });
        }
      },
    });
  };

  const borderGlow = isIndexing ? 'border-amber-500/40 bg-amber-500/5' :
                     isReady    ? 'border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/40' :
                     isFailed   ? 'border-red-500/30 bg-red-500/5' :
                                  'border-white/10 bg-white/[0.02] hover:border-white/20';

  return (
    <div className={cn('relative rounded-2xl border overflow-hidden transition-all duration-300', borderGlow, forceListMode ? 'p-3 flex items-center' : 'p-4 flex flex-col')}>
      {/* Dense Top Row */}
      <div className={cn("flex items-start gap-3", forceListMode && "items-center flex-1")}>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-inner transition-colors',
          isReady ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-zinc-400'
        )}>
          {repository.remote_url ? <Globe className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="text-[14px] font-semibold tracking-tight text-white truncate break-all pr-2">
              {repository.repo_id}
            </h3>
            {!forceListMode && (
              <div className="flex items-center">
                {isIndexing ? <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" /> :
                 isReady ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> :
                 isFailed ? <XCircle className="h-3.5 w-3.5 text-red-400" /> :
                 <Clock className="h-3.5 w-3.5 text-zinc-500" />}
              </div>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-mono truncate">{repository.remote_url || repository.local_path || 'Disconnected'}</p>
        </div>
      </div>

      {!forceListMode && (
        <div className="flex items-center justify-between mt-4 mb-4 p-2 rounded-xl bg-black/40 border border-white/5 mx-1">
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-medium"><GitBranch className="h-3 w-3 text-violet-400"/> {repository.default_branch}</div>
          <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-medium"><RefreshCw className="h-3 w-3 text-emerald-400"/> v{repository.indexing_version || 1}</div>
          {repository.latest_indexed_chunks != null && (
            <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-medium"><Database className="h-3 w-3 text-indigo-400"/> {repository.latest_indexed_chunks}</div>
          )}
        </div>
      )}

      {/* Action Row */}
      <div className={cn("mt-auto", forceListMode && "mt-0 flex shrink-0 items-center gap-3")}>
        {isIndexing ? (
          <div className="w-full space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              <span>{progress?.message || 'Processing'}</span>
              <span>{Math.round(progress?.percentage || 0)}%</span>
            </div>
            <Progress value={progress?.percentage || 0} variant="ai" className="h-1" animated />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            {!forceListMode && (
              <span className="text-[10px] text-zinc-600 font-medium">{repository.updated_at ? formatDate(repository.updated_at) : 'Standby'}</span>
            )}
            <div className="flex gap-2 w-full justify-end">
              {isReady && (
                <Button variant="outline" size="sm" onClick={() => router.push('/chat')} className="h-7 px-3 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                  <Bot className="h-3 w-3 mr-1.5" /> Chat
                </Button>
              )}
              <Button size="sm" onClick={handleIndex} disabled={!!isIndexing} className={cn("h-7 px-3 text-[11px]", isReady ? "bg-white/10 hover:bg-white/20 text-white" : "bg-indigo-500 hover:bg-indigo-600 text-white")}>
                <Zap className="h-3 w-3 mr-1.5" /> {isReady ? 'Sync' : 'Init'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   REPOSITORIES PAGE (Ultra Dense)
══════════════════════════════════════════════════════ */
export default function RepositoriesPage() {
  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [showNewProject, setShowNewProject] = React.useState(false);

  const { repositories, isLoading, refetch } = useRepositories(selectedProjectId);

  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pt-4 pb-12 w-full">
      {/* Sleek inline header */}
      <div className="flex items-center justify-between px-2 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
            <Database className="h-3.5 w-3.5" /> Pipeline Dashboard
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connected Sources ({repositories.length})</h1>
        </div>
        <button onClick={() => refetch()} disabled={isLoading} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          <RefreshCw className={cn('h-4 w-4 text-zinc-300', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Workspace Layer */}
      <div className="px-2 space-y-3">
        <AnimatePresence>{showNewProject && <NewProjectInlineForm onDone={() => setShowNewProject(false)} />}</AnimatePresence>
        <ProjectTabs projects={projects} selectedId={selectedProjectId} onSelect={setSelectedProjectId} isLoading={projectsLoading} onCreate={() => setShowNewProject(true)} />
      </div>

      {/* Connection Layer */}
      <div className="px-2"><AddRepoForm projectId={selectedProjectId} /></div>

      {/* Repos Grid */}
      <div className="px-2 pt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">Indexed Artifacts</h2>
          <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
            <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white')}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white')}><List className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {isLoading ? (
          <div className={cn(viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3')}>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl bg-white/5" />)}
          </div>
        ) : repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/10 text-center bg-black/20">
            <Database className="h-8 w-8 text-zinc-600 mb-3" />
            <p className="text-[15px] font-bold text-white">No Repositories Hooked</p>
            <p className="text-[13px] text-zinc-500 mt-1 max-w-sm">Connect a codebase above to begin vectorizing data.</p>
          </div>
        ) : (
          <div className={cn(viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3')}>
            {repositories.map((repo) => <RepoCard key={repo.id} repository={repo} forceListMode={viewMode === 'list'} />)}
          </div>
        )}
      </div>
    </div>
  );
}
