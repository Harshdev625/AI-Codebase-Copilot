import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { useRepositories, usePatches, useSnapshots } from '@/features/repositories/hooks/use-repositories';
import { useChatSessions } from '@/features/chat/hooks/use-chat';
import { useRepositoryTree } from '@/features/repositories/hooks/use-repositories';

export function useHydrationValidation() {
  const { 
    selectedRepositoryId, 
    activeSessionId, 
    activePatchId, 
    selectedSnapshotId, 
    validateHydration 
  } = useWorkspaceStore();

  const { repositories, isLoading: reposLoading } = useRepositories();
  const { data: sessionsData, isLoading: sessionsLoading } = useChatSessions(100, 0, selectedRepositoryId || undefined);
  const { data: patchesData, isLoading: patchesLoading } = usePatches(selectedRepositoryId || '');
  const { data: snapshotsData, isLoading: snapshotsLoading } = useSnapshots(selectedRepositoryId || '');
  const { data: treeData, isLoading: treeLoading } = useRepositoryTree(selectedRepositoryId || '');

  useEffect(() => {
    if (reposLoading || sessionsLoading || patchesLoading || snapshotsLoading || treeLoading) return;

    const validRepos = repositories.map(r => r.id);
    const validSessions = sessionsData?.items?.map(s => s.id) || [];
    const validPatches = patchesData?.map((p: any) => p.id) || [];
    const validSnapshots = snapshotsData?.snapshots?.map((s: any) => s.id) || [];
    
    // Extract all valid file paths from tree if available
    const validPaths: string[] = [];
    if (treeData?.items) {
       // Since the tree only gives root paths, true deep validation requires full index scan.
       // For safety, we only use what we have, or skip path validation if tree is incomplete.
       // Actually, we'll just skip strict path validation for now to avoid aggressively closing tabs 
       // that are deep in the tree and not returned by the top-level tree API.
       // validPaths = ...
    }

    // Call validation
    validateHydration(validRepos, validSessions, validPatches, validSnapshots, []);
    
  }, [
    reposLoading, sessionsLoading, patchesLoading, snapshotsLoading, treeLoading,
    repositories, sessionsData, patchesData, snapshotsData, treeData,
    validateHydration
  ]);
}
