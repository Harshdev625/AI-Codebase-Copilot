'use client';

import React from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { Files, Search, Camera, Settings, MessageSquare, History, Activity, GitPullRequestDraft, ShieldCheck, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export function ActivityBar() {
  const { activeSidebarPanel, toggleSidebarPanel, isChatOpen, setChatOpen } = useWorkspaceStore();

  const primaryItems = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'snapshots', icon: Camera, label: 'Snapshots' },
    { id: 'sessions', icon: History, label: 'Sessions' },
    { id: 'patches', icon: GitPullRequestDraft, label: 'Patches' },
    { id: 'tasks', icon: Activity, label: 'Background Tasks' },
  ] as const;

  const secondaryItems = [
    { id: 'admin', icon: ShieldCheck, label: 'Admin Dashboard', isTab: true },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ] as const;

  return (
    <div className="w-12 h-full flex flex-col border-r bg-surface z-10">
      <div className="flex-1 flex flex-col items-center py-2 space-y-2">
        {primaryItems.map((item) => (
          <Tooltip key={item.id} content={<p>{item.label}</p>} side="right">
            <Button
              variant="ghost"
              size="icon"
              className={`w-10 h-10 rounded-lg ${activeSidebarPanel === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              onClick={() => toggleSidebarPanel(item.id)}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col items-center py-2 space-y-2">
        <Tooltip content={<p>Open Chat</p>} side="right">
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-lg text-muted-foreground"
            onClick={() => {
              useWorkspaceStore.getState().openTab({
                id: 'chat-main',
                type: 'chat',
                title: 'Chat'
              });
            }}
          >
            <MessageSquare className="w-5 h-5" strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Tooltip content={<p>Toggle Context Panel</p>} side="right">
          <Button
            variant="ghost"
            size="icon"
            className={`w-10 h-10 rounded-lg ${isChatOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setChatOpen(!isChatOpen)}
          >
            <PanelRightClose className="w-5 h-5" strokeWidth={1.5} />
          </Button>
        </Tooltip>

        {secondaryItems.map((item) => (
          <Tooltip key={item.id} content={<p>{item.label}</p>} side="right">
            <Button
              variant="ghost"
              size="icon"
              className={`w-10 h-10 rounded-lg ${activeSidebarPanel === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              onClick={() => {
                if ('isTab' in item && item.isTab) {
                  useWorkspaceStore.getState().openTab({
                    id: item.id,
                    type: item.id as any,
                    title: item.label
                  });
                } else {
                  toggleSidebarPanel(item.id as any);
                }
              }}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
