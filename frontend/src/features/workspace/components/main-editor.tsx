'use client';

import React from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { MonacoViewer } from './monaco-viewer';
import { MonacoDiffViewer } from './monaco-diff-viewer';
import { PatchReviewEditor } from './patch-review-editor';
import AdminDashboardPage from '@/app/admin/dashboard/page';
import { X } from 'lucide-react';

import { ChatWorkspace } from '@/features/chat/components/chat-workspace';

export function MainEditor() {
  const { tabs, activeTabId, setActiveTabId, closeTab, selectedRepositoryId } = useWorkspaceStore();

  if (tabs.length === 0) {
    return (
      <div className="flex-1 h-full bg-background flex flex-col min-w-0 overflow-hidden">
        <ChatWorkspace repositoryId={selectedRepositoryId || undefined} />
      </div>
    );
  }

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex-1 h-full bg-background flex flex-col min-w-0">
      {activeTab?.type !== 'chat' && (
        <div className="flex h-10 border-b bg-surface overflow-x-auto no-scrollbar shrink-0">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center px-4 h-full border-r cursor-pointer min-w-max select-none transition-colors ${
                activeTabId === tab.id
                  ? 'bg-background text-foreground border-t-2 border-t-primary'
                  : 'text-muted-foreground hover:bg-muted/50 border-t-2 border-t-transparent'
              }`}
            >
              <span className="text-sm mr-2">{tab.title}</span>
              {tab.isDirty && <span className="w-2 h-2 rounded-full bg-primary mr-2" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-0.5 rounded-sm hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 relative overflow-hidden">
        {activeTab?.type === 'code' && (
          <MonacoViewer 
            content={activeTab.content || ''} 
            filePath={activeTab.filePath}
            initialLine={activeTab.initialLine}
          />
        )}
        {activeTab?.type === 'diff' && (
          <MonacoDiffViewer 
            originalContent={activeTab.content?.split('|||')[0] || ''} 
            modifiedContent={activeTab.content?.split('|||')[1] || ''} 
            filePath={activeTab.filePath}
          />
        )}
        {activeTab?.type === 'patch-review' && (
          <PatchReviewEditor patchId={activeTab.content || ''} />
        )}
        {activeTab?.type === 'settings' && (
          <div className="p-8">
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground">Settings content goes here.</p>
          </div>
        )}
        {activeTab?.type === 'admin' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <AdminDashboardPage />
          </div>
        )}
        {activeTab?.type === 'chat' && (
          <div className="h-full w-full">
            <ChatWorkspace />
          </div>
        )}
      </div>
    </div>
  );
}
