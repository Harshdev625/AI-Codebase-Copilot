'use client';

import * as React from 'react';
import { LayoutGrid, List, RefreshCw, Plus, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { RepositoryProjectSidebar } from '@/features/repositories/components/repository-project-sidebar';
import { RepositoryAddForm } from '@/features/repositories/components/repository-add-form';
import { RepositoryItemCard } from '@/features/repositories/components/repository-item-card';
import { useRepositories, useProjects } from '@/features/repositories/hooks/use-repositories';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { Surface } from '@/components/ui/surface';

export default function RepositoriesPage() {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  
  const { repositories, isLoading, refetch } = useRepositories(selectedProjectId);

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  return (
    <div className="flex h-full flex-col gap-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
             <Database className="h-5 w-5" />
             <span className="text-[10px] font-bold uppercase tracking-widest">Source Control</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Management</h1>
          <p className="text-sm text-muted-foreground font-medium max-w-xl">
             Manage and index your code repositories across different vertical environments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-muted/20 p-1 border border-border/40">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8 rounded-lg" 
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="h-8 w-8 rounded-lg" 
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => void refetch()} 
            disabled={isLoading}
            className="h-10 border-border/40 bg-background/50 backdrop-blur-sm"
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} />
            Sync
          </Button>

          <Button 
            variant="default" 
            size="sm" 
            className="h-10 shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" />
            Connect Source
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-10 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
           <RepositoryProjectSidebar 
             selectedProjectId={selectedProjectId} 
             onSelectProject={setSelectedProjectId} 
           />
        </aside>

        <section className="space-y-10">
          <Surface variant="flat" className="p-0 border-none bg-transparent">
             <RepositoryAddForm projectId={selectedProjectId} />
          </Surface>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-48 rounded-2xl bg-muted/20" />
              ))}
            </div>
          ) : repositories.length === 0 ? (
            <div className="py-20">
              <EmptyState
                title="No indexed sources"
                description="This project context hasn't been mapped yet. Add a repository link to begin indexing."
              />
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" 
                : "flex flex-col gap-4"
            )}>
              {repositories.map((repo) => (
                <RepositoryItemCard key={repo.id} repository={repo} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
