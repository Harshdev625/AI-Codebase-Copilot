"use client";

import * as React from "react";
import { PanelLeftClose } from "lucide-react";

import type { ChatSession } from "@/features/chat/types/chat-types";
import type { Repository } from "@/features/repositories/types/repository-types";
import { Button } from "@/components/ui/button";
import { BackgroundTasksPanel } from "@/features/studio/panels/background-tasks-panel";
import { PatchListPanel } from "@/features/studio/panels/patch-list-panel";
import { SearchPanel } from "@/features/studio/panels/search-panel";
import { SnapshotTimeline } from "@/features/repositories/components/snapshot-timeline";

import { useStudioStore } from "../store/studio-store";
import { StudioExplorerPanel } from "./studio-explorer-panel";

const PANEL_TITLES: Record<string, string> = {
  explorer: "EXPLORER",
  search: "SEARCH",
  snapshots: "SNAPSHOTS",
  patches: "PATCHES",
  tasks: "BACKGROUND TASKS",
};

interface StudioPrimarySidebarProps {
  sessions: ChatSession[];
  sessionsLoading: boolean;
  currentSessionId: string | null;
  repositories: Repository[];
  repositoryId?: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession?: (id: string, title: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onArchiveSession?: (id: string, isArchived: boolean) => void;
}

export function StudioPrimarySidebar({
  repositories: _repositories,
  repositoryId: _repositoryId,
  sessions: _sessions,
  sessionsLoading: _sessionsLoading,
  currentSessionId: _currentSessionId,
  onSelectSession: _onSelectSession,
  onNewSession: _onNewSession,
  onDeleteSession: _onDeleteSession,
  onRenameSession: _onRenameSession,
  onTogglePin: _onTogglePin,
  onArchiveSession: _onArchiveSession,
}: StudioPrimarySidebarProps) {
  const { primarySidebar, selectedRepositoryId, openPatchTab, setSidebarCollapsed } =
    useStudioStore();

  const title = PANEL_TITLES[primarySidebar] ?? primarySidebar.toUpperCase();

  const renderPanel = () => {
    switch (primarySidebar) {
      case "explorer":
        return <StudioExplorerPanel />;
      case "search":
        return <SearchPanel />;
      case "snapshots":
        return selectedRepositoryId ? (
          <SnapshotTimeline repositoryId={selectedRepositoryId} />
        ) : (
          <EmptyRepoHint />
        );
      case "patches":
        return <PatchListPanel onPatchClick={(patchId) => openPatchTab(patchId)} />;
      case "tasks":
        return <BackgroundTasksPanel />;
      default:
        return null;
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[#13151A] border-r border-[#1E212B]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1E212B] px-4 xl:h-11">
        <span className="text-[11px] font-bold tracking-widest text-[#8B949E] xl:text-xs">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-[#8B949E] md:flex xl:h-9 xl:w-9"
          onClick={() => setSidebarCollapsed(true)}
          title="Hide sidebar (Ctrl+B)"
          aria-label="Hide sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">{renderPanel()}</div>
    </aside>
  );
}

function EmptyRepoHint() {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[#8B949E]">
      Select a repository from the dashboard to use this panel.
    </div>
  );
}
