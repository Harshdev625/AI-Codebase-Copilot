'use client';

import React, { Suspense } from 'react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { useWorkspaceStore } from '@/features/workspace/store/workspace-store';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRepositories } from '@/features/repositories/hooks/use-repositories';

function WorkspacePageContent() {
  const [mounted, setMounted] = React.useState(false);
  const { selectedRepositoryId, setActiveSessionId, setSelectedRepositoryId, activeSessionId } = useWorkspaceStore();
  const { repositories, isLoading } = useRepositories();
  
  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync URL -> State on mount or URL change
  React.useEffect(() => {
    if (!mounted) return;
    const urlRepoId = searchParams.get('repository_id');
    const urlSessionId = searchParams.get('session_id');
    
    if (urlRepoId && urlRepoId !== selectedRepositoryId) setSelectedRepositoryId(urlRepoId);
    if (urlSessionId && urlSessionId !== activeSessionId) setActiveSessionId(urlSessionId);
  }, [searchParams, selectedRepositoryId, activeSessionId, setSelectedRepositoryId, setActiveSessionId, mounted]);

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

  if (!mounted) return null;

  return (
    <div className="h-screen w-screen bg-[#0B0D14]">
      <ChatWorkspace 
        repositoryId={selectedRepositoryId || undefined} 
        repositories={repositories} 
        isRepositoriesLoading={isLoading} 
      />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0B0D14]" />}>
      <WorkspacePageContent />
    </Suspense>
  );
}
