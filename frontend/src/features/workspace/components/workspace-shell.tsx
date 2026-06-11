'use client';

import React from 'react';
import { ActivityBar } from './activity-bar';
import { LeftSidebar } from './left-sidebar';
import { MainEditor } from './main-editor';
import { StatusBar } from './status-bar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkspaceStore } from '../store/workspace-store';
import { useHydrationValidation } from '../hooks/use-hydration-validation';

import { useSearchParams, useRouter } from 'next/navigation';

export function WorkspaceShell() {
  const [mounted, setMounted] = React.useState(false);
  useHydrationValidation();
  const { activeSidebarPanel, tabs, activeTabId, selectedRepositoryId, setActiveSessionId, setSelectedRepositoryId, activeSessionId } = useWorkspaceStore();
  
  const searchParams = useSearchParams();
  const router = useRouter();

  // Sync URL -> State on mount or URL change
  React.useEffect(() => {
    const urlRepoId = searchParams.get('repository_id');
    const urlSessionId = searchParams.get('session_id');
    
    if (urlRepoId && urlRepoId !== selectedRepositoryId) setSelectedRepositoryId(urlRepoId);
    if (urlSessionId && urlSessionId !== activeSessionId) setActiveSessionId(urlSessionId);
  }, [searchParams, selectedRepositoryId, activeSessionId, setSelectedRepositoryId, setActiveSessionId]);

  // Sync State -> URL
  React.useEffect(() => {
    if (!mounted) return;
    const currentRepo = searchParams.get('repository_id');
    const currentSession = searchParams.get('session_id');
    
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    
    if (selectedRepositoryId && selectedRepositoryId !== currentRepo) {
      params.set('repository_id', selectedRepositoryId);
      changed = true;
    }
    if (activeSessionId && activeSessionId !== currentSession) {
      params.set('session_id', activeSessionId);
      changed = true;
    }
    
    if (changed) {
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedRepositoryId, activeSessionId, mounted, router, searchParams]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-screen w-screen bg-background" />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background overflow-hidden text-foreground">
      {/* Main workspace area: activity bar + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Activity Bar — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex shrink-0 w-12 border-r bg-surface z-20">
          <ActivityBar />
        </div>

        {/* Main content: sidebar (collapsible) + editor */}
        <div className="flex-1 min-w-0 relative overflow-hidden flex">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            {activeSidebarPanel !== null && (
              <>
                <ResizablePanel
                  defaultSize={20}
                  minSize={15}
                  maxSize={45}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => useWorkspaceStore.getState().setActiveSidebarPanel(null)}
                  className="bg-background shadow-lg z-10 min-w-0"
                >
                  <LeftSidebar />
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/30 transition-colors z-20" />
              </>
            )}
            <ResizablePanel defaultSize={100} className="min-w-0 flex flex-col z-0">
              <MainEditor />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Status bar — full width at bottom */}
      <div className="shrink-0 z-30">
        <StatusBar />
      </div>
    </div>
  );
}