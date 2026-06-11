import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudioStore } from '../store/studio-store';
import type { CanvasMode, SecondaryPanel } from '../types/studio-types';

/**
 * Bidirectional synchronization between URL query params and Studio store.
 * Phase 1: Syncs repository_id, session_id, view (canvas mode), and panel.
 */
export function useStudioUrlSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const {
    selectedRepositoryId,
    activeSessionId,
    canvasMode,
    secondaryPanel,
    setSelectedRepositoryId,
    setActiveSessionId,
    setCanvasMode,
    setSecondaryPanel,
  } = useStudioStore();

  // Sync from URL to store on mount and param changes
  React.useEffect(() => {
    const repositoryId = searchParams.get('repository_id');
    const sessionId = searchParams.get('session_id');
    const view = searchParams.get('view') as CanvasMode | null;
    const panel = searchParams.get('panel') as SecondaryPanel | null;

    if (repositoryId && repositoryId !== selectedRepositoryId) {
      setSelectedRepositoryId(repositoryId);
    }
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
    }
    if (view && view !== canvasMode) {
      setCanvasMode(view);
    }
    if (panel && panel !== secondaryPanel) {
      setSecondaryPanel(panel);
    }
  }, [searchParams]);

  // Sync from store to URL when state changes (debounced)
  const updateUrl = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (selectedRepositoryId) {
      params.set('repository_id', selectedRepositoryId);
    } else {
      params.delete('repository_id');
    }
    
    if (activeSessionId) {
      params.set('session_id', activeSessionId);
    } else {
      params.delete('session_id');
    }
    
    if (canvasMode && canvasMode !== 'chat') {
      params.set('view', canvasMode);
    } else {
      params.delete('view');
    }
    
    if (secondaryPanel) {
      params.set('panel', secondaryPanel);
    } else {
      params.delete('panel');
    }
    
    const newUrl = `/studio?${params.toString()}`;
    router.replace(newUrl);
  }, [selectedRepositoryId, activeSessionId, canvasMode, secondaryPanel, searchParams, router]);

  // Debounce URL updates to avoid excessive navigation
  React.useEffect(() => {
    const timeoutId = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeoutId);
  }, [updateUrl]);

  return {
    syncToUrl: updateUrl,
  };
}
