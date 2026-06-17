"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { ContextPanel } from "@/features/chat/components/context-panel";
import {
  useChat,
  useChatSession,
  useChatSessions,
  useDeleteSessionMutation,
  useUpdateSessionMutation,
} from "@/features/chat/hooks/use-chat";
import type { Repository } from "@/features/repositories/types/repository-types";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBar } from "@/features/studio/panels/status-bar";
import { SettingsPanel } from "@/features/studio/panels/settings-panel";
import { cn } from "@/lib/utils";

import { StudioWorkbenchProvider } from "../context/studio-workbench-context";
import { useStudioStore } from "../store/studio-store";
import { GlobalTopBar } from "./global-top-bar";
import { StudioNavRail } from "./studio-nav-rail";
import { StudioPrimarySidebar } from "./studio-primary-sidebar";
import { StudioSessionSidebar } from "./studio-session-sidebar";
import { StudioCanvasChat } from "./studio-canvas-chat";
import { AiDockPanel } from "../workbench/ai-dock-panel";
import { ScopeBar } from "../workbench/scope-bar";

const EditorWorkbench = dynamic(
  () => import("../workbench/editor-workbench").then((m) => m.EditorWorkbench),
  { ssr: false },
);

export interface StudioV2ShellProps {
  repositoryId?: string;
  repositories?: Repository[];
  isRepositoriesLoading?: boolean;
}

function ContextColumn({ repositoryId }: { repositoryId?: string }) {
  const { contextPanelOpen, toggleContextPanel } = useStudioStore();
  const { repositories } = useRepositories();
  const repo = repositories.find((r) => r.id === repositoryId);
  const repoLabel = repo?.repo_id?.split("/").pop() ?? "Repository";

  if (!contextPanelOpen) {
    return (
      <div
        className="flex shrink-0 flex-col border-l border-[#1E212B] bg-[#0F1117] px-1 py-2"
        data-testid="studio-context-panel-collapsed"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 xl:h-11 xl:w-11"
          onClick={toggleContextPanel}
          title="Show context panel"
          aria-label="Show context panel"
        >
          <PanelRightOpen className="h-[18px] w-[18px] xl:h-5 xl:w-5" />
        </Button>
      </div>
    );
  }

  return (
    <aside
      className="flex h-full w-[min(300px,22vw)] min-w-[260px] shrink-0 flex-col overflow-hidden border-l border-[#1E212B] bg-[#13151A]"
      data-testid="studio-context-panel"
      aria-label="Repository context"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[#1E212B] px-3 xl:h-11">
        <div className="min-w-0">
          <span className="text-[10px] font-bold tracking-widest text-[#6E7681]">CONTEXT</span>
          <p className="truncate text-xs font-medium text-[#C9D1D9]" title={repo?.repo_id}>
            {repoLabel}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[#8B949E] hover:text-[#C9D1D9]"
          onClick={toggleContextPanel}
          title="Hide context panel"
          aria-label="Hide context panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <ContextPanel repositoryId={repositoryId} embedded />
      </div>
    </aside>
  );
}

export function StudioV2Shell({
  repositoryId,
  repositories = [],
  isRepositoriesLoading = false,
}: StudioV2ShellProps): React.JSX.Element {
  const {
    primarySidebar,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    settingsOpen,
    setSettingsOpen,
    mobileTab,
    setMobileTab,
    activeSessionId,
    setActiveSessionId,
  } = useStudioStore();

  const isChatMode = primarySidebar === "sessions";

  const chat = useChat({ repositoryId });

  const sessionsQuery = useChatSessions(100, 0, undefined, undefined, false);
  const orphanSessionQuery = useChatSession(
    chat.currentSessionId &&
      !sessionsQuery.data?.items?.some((s) => s.id === chat.currentSessionId)
      ? chat.currentSessionId
      : null,
  );
  const deleteMutation = useDeleteSessionMutation();
  const updateMutation = useUpdateSessionMutation();

  const sessions = React.useMemo(() => {
    const listed = sessionsQuery.data?.items ?? [];
    const orphan = orphanSessionQuery.data;
    if (orphan && !listed.some((s) => s.id === orphan.id)) {
      return [orphan, ...listed];
    }
    return listed;
  }, [sessionsQuery.data?.items, orphanSessionQuery.data]);

  React.useEffect(() => {
    if (orphanSessionQuery.isError && chat.currentSessionId) {
      chat.clearMessages();
    }
  }, [orphanSessionQuery.isError, chat.currentSessionId, chat.clearMessages]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        useStudioStore.getState().focusSidebar("sessions");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebarCollapsed]);

  const workbenchSession = React.useMemo(
    () => ({
      activeSessionId: activeSessionId ?? chat.currentSessionId,
      setActiveSessionId: (id: string | null) => {
        if (id === activeSessionId) return;
        setActiveSessionId(id);
        if (id && id !== chat.currentSessionId) chat.selectSession(id);
        else if (!id) chat.clearMessages();
      },
    }),
    [activeSessionId, chat.currentSessionId, chat.selectSession, chat.clearMessages, setActiveSessionId],
  );

  const sessionSidebarProps = {
    sessions,
    isLoading: sessionsQuery.isLoading,
    currentSessionId: chat.currentSessionId,
    repositories,
    repositoryId,
    onSelectSession: (id: string) => {
      setActiveSessionId(id);
      chat.selectSession(id);
    },
    onDeleteSession: (id: string) => deleteMutation.mutateAsync(id),
    onNewSession: () => {
      chat.clearMessages();
      setActiveSessionId(null);
    },
    onRenameSession: (id: string, title: string) =>
      updateMutation.mutateAsync({ sessionId: id, payload: { session_title: title } }),
    onTogglePin: (id: string, isPinned: boolean) =>
      updateMutation.mutateAsync({ sessionId: id, payload: { is_pinned: isPinned } }),
    onArchiveSession: (id: string, isArchived: boolean) =>
      updateMutation.mutateAsync({ sessionId: id, payload: { is_archived: isArchived } }),
  };

  const toolSidebarProps = {
    sessions,
    sessionsLoading: sessionsQuery.isLoading,
    currentSessionId: chat.currentSessionId,
    repositories,
    repositoryId,
    onSelectSession: sessionSidebarProps.onSelectSession,
    onDeleteSession: sessionSidebarProps.onDeleteSession,
    onNewSession: sessionSidebarProps.onNewSession,
    onRenameSession: sessionSidebarProps.onRenameSession,
    onTogglePin: sessionSidebarProps.onTogglePin,
    onArchiveSession: sessionSidebarProps.onArchiveSession,
  };

  return (
    <StudioWorkbenchProvider value={workbenchSession}>
      <div
        className="studio-workbench flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
        data-studio-shell="v2"
        data-studio-mode={isChatMode ? "chat" : "editor"}
      >
        <GlobalTopBar />

        {/* Desktop — fixed flex columns (no percentage resize slivers) */}
        <div className="hidden min-h-0 flex-1 overflow-hidden md:flex">
          <StudioNavRail />

          {sidebarCollapsed && (
            <div className="flex shrink-0 flex-col border-r border-[#1E212B] bg-[#0F1117] px-1 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 xl:h-11 xl:w-11"
                onClick={() => setSidebarCollapsed(false)}
                title="Show sidebar (Ctrl+B)"
                aria-label="Show sidebar"
              >
                <PanelLeftOpen className="h-[18px] w-[18px] xl:h-5 xl:w-5" />
              </Button>
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {!sidebarCollapsed && (
              <div className="flex h-full w-[min(300px,22vw)] min-w-[260px] shrink-0 flex-col border-r border-[#1E212B]">
                {isChatMode ? (
                  <StudioSessionSidebar {...sessionSidebarProps} />
                ) : (
                  <>
                    <StudioPrimarySidebar {...toolSidebarProps} />
                    <ScopeBar />
                  </>
                )}
              </div>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {isChatMode ? (
                <StudioCanvasChat
                  variant="canvas"
                  repositoryId={repositoryId}
                  repositories={repositories}
                  isRepositoriesLoading={isRepositoriesLoading}
                  chat={chat}
                  sessions={sessions}
                />
              ) : (
                <EditorWorkbench />
              )}
            </div>

            {repositoryId && <ContextColumn repositoryId={repositoryId} />}
          </div>
        </div>

        {/* Mobile */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileTab === "editor" && <EditorWorkbench />}
            {mobileTab === "files" && (
              <div className="flex h-full">
                <StudioNavRail />
                <StudioPrimarySidebar {...toolSidebarProps} />
              </div>
            )}
            {mobileTab === "ai" && (
              <AiDockPanel
                repositoryId={repositoryId}
                repositories={repositories}
                isRepositoriesLoading={isRepositoriesLoading}
                chat={chat}
                sessions={sessions}
                onDeleteSession={sessionSidebarProps.onDeleteSession}
                onRenameSession={sessionSidebarProps.onRenameSession}
                onTogglePin={sessionSidebarProps.onTogglePin}
                onArchiveSession={sessionSidebarProps.onArchiveSession}
              />
            )}
          </div>
          <nav
            className="flex shrink-0 border-t border-border bg-card"
            role="tablist"
            aria-label="Studio mobile navigation"
          >
            {(
              [
                { id: "ai" as const, label: "Chat" },
                { id: "files" as const, label: "Files" },
                { id: "editor" as const, label: "Editor" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-semibold",
                  mobileTab === tab.id
                    ? "border-t-2 border-primary text-primary"
                    : "text-muted-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <StatusBar />

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              <SettingsPanel />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </StudioWorkbenchProvider>
  );
}
