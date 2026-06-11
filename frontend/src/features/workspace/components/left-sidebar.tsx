'use client';

import React from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { SnapshotTimeline } from '@/features/repositories/components/snapshot-timeline';
import { LazyTreeNode } from '@/features/explorer/components/lazy-tree-node';
import { useRepositoryTree, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useChat, useChatSessions, useDeleteSessionMutation, useUpdateSessionMutation } from '@/features/chat/hooks/use-chat';
import { ChatSessionSidebar } from '@/features/chat/components/chat-session-sidebar';
import { RepositorySelector } from './repository-selector';
import { BackgroundTasksPanel } from './background-tasks-panel';
import { PatchListPanel } from './patch-list-panel';
import { SearchPanel } from './search-panel';
import { SettingsPanel } from './settings-panel';

export function LeftSidebar() {
  const { activeSidebarPanel, selectedRepositoryId, openTab, updateTab, setChatOpen } = useWorkspaceStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find(r => r.id === selectedRepositoryId);
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data, isLoading } = useRepositoryTree(
    selectedRepositoryId || '',
    activeSidebarPanel === 'explorer' ? '' : undefined
  );

  const { currentSessionId, selectSession, clearMessages, isSending } = useChat({ repositoryId: selectedRepositoryId || undefined });
  const sessionsQuery = useChatSessions(100, 0);
  const deleteMutation = useDeleteSessionMutation();
  const updateSessionMutation = useUpdateSessionMutation();

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery.trim()) return data.items;
    return data.items.filter(item => 
      item.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.items, searchQuery]);

  const handleFileSelect = async (path: string) => {
    if (!selectedRepository) return;
    const tabId = `${selectedRepository.id}-${path}`;
    openTab({
      id: tabId,
      title: path.split('/').pop() || path,
      type: 'code',
      filePath: path,
      content: '// Loading...'
    });

    try {
      import('@/features/repositories/services/repository-service').then(async ({ repositoryService }) => {
        try {
          const res = await repositoryService.getFileContent(selectedRepository.id, path);
          updateTab(tabId, { content: res.content });
        } catch (error) {
          updateTab(tabId, { content: `// Failed to load file content: ${error}` });
        }
      });
    } catch (err) {
      updateTab(tabId, { content: `// Error: ${err}` });
    }
  };

  const activeSession = currentSessionId ? sessionsQuery.data?.items?.find((s: any) => s.id === currentSessionId) : null;
  const scopePaths = activeSession?.metadata?.scope_paths || [];

  const handleToggleContext = (path: string) => {
    if (!currentSessionId) return;
    let newPaths = [...scopePaths];
    if (newPaths.includes(path)) {
      newPaths = newPaths.filter(p => p !== path);
    } else {
      newPaths.push(path);
    }
    updateSessionMutation.mutate({ 
      sessionId: currentSessionId, 
      payload: { metadata: { scope_paths: newPaths } } 
    });
  };

  return (
    <div className="w-full h-full border-r bg-surface flex flex-col z-10 overflow-hidden">
      <div className="h-10 border-b flex items-center px-4 font-semibold text-sm uppercase tracking-wider text-muted-foreground shrink-0">
        {activeSidebarPanel}
      </div>
      <RepositorySelector />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {activeSidebarPanel === 'explorer' && (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b relative shrink-0">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input 
                placeholder="Filter files..." 
                className="pl-9 h-8 bg-background/50 border-border/40 text-xs focus-visible:ring-1 focus-visible:ring-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {selectedRepository ? (
                isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs">Loading tree structure...</span>
                  </div>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((node) => (
                    <LazyTreeNode
                      key={node.id || node.path}
                repoId={selectedRepository.id}
                name={node.path.split("/").pop() || node.path}
                path={node.path}
                type={node.type}
                status={node.status}
                onFileSelect={handleFileSelect}
                onToggleContext={currentSessionId ? handleToggleContext : undefined}
                scopePaths={scopePaths}
              />
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/45 italic text-xs">
              No files found
            </div>
          )
        ) : (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Select a repository to view files.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeSidebarPanel === 'sessions' && (
          <div className="flex flex-col h-full overflow-hidden w-full">
            <ChatSessionSidebar
              sessions={(sessionsQuery.data?.items as any[]) || []}
              isLoading={sessionsQuery.isLoading}
              currentSessionId={currentSessionId}
              onSelectSession={(id) => { 
                selectSession(id); 
                openTab({ id: 'chat-main', type: 'chat', title: 'Chat' });
                setChatOpen(true); 
              }}
              onDeleteSession={(id) => deleteMutation.mutateAsync(id)}
              onNewSession={() => { 
                clearMessages(); 
                openTab({ id: 'chat-main', type: 'chat', title: 'Chat' });
                setChatOpen(true); 
              }}
              onTogglePin={(id, isPinned) => updateSessionMutation.mutateAsync({ sessionId: id, payload: { is_pinned: isPinned } })}
              onRenameSession={(id, title) => updateSessionMutation.mutateAsync({ sessionId: id, payload: { session_title: title } })}
              onArchiveSession={(id, isArchived) => updateSessionMutation.mutateAsync({ sessionId: id, payload: { is_archived: isArchived } })}
              isSending={isSending}
              repositoryId={selectedRepository?.id}
            />
          </div>
        )}
        {activeSidebarPanel === 'search' && (
          <SearchPanel />
        )}
        {activeSidebarPanel === 'snapshots' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {selectedRepository ? (
              <SnapshotTimeline repositoryId={selectedRepository.id} />
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Select a repository to view snapshots.</p>
              </div>
            )}
          </div>
        )}
        {activeSidebarPanel === 'tasks' && (
          <BackgroundTasksPanel />
        )}
        {activeSidebarPanel === 'patches' && (
          <PatchListPanel />
        )}
        {activeSidebarPanel === 'settings' && (
          <SettingsPanel />
        )}
      </div>
    </div>
  );
}
