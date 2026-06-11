"use client";

import * as React from "react";

import { ContextPanel } from "@/features/chat/components/context-panel";
import { useChatSessions, useDeleteSessionMutation, useUpdateSessionMutation } from "@/features/chat/hooks/use-chat";
import type { Repository } from "@/features/repositories/types/repository-types";
import { StatusBar } from "@/features/workspace/components/status-bar";

import { useStudioStore } from "../store/studio-store";
import { GlobalTopBar } from "./global-top-bar";
import { StudioCanvas } from "./studio-canvas";
import { StudioNavRail } from "./studio-nav-rail";
import { StudioSecondaryPanel } from "./studio-secondary-panel";
import { StudioSessionSidebar } from "./studio-session-sidebar";

export interface CopilotStudioShellProps {
  repositoryId?: string;
  repositories?: Repository[];
  isRepositoriesLoading?: boolean;
}

/**
 * Phase 1 Unified Copilot Studio shell.
 *
 * Layout (flex-col, full viewport):
 * ┌────────────────────────────────────────────────────────┐
 * │  GlobalTopBar (h-12)                                   │
 * ├────┬──────────┬────────────────────────┬───────────────┤
 * │ NR │ Sec Panel│  StudioCanvas (flex-1) │  ContextPanel │
 * │48px│ (if open)│                        │  280px        │
 * │    │  280px   │                        │               │
 * ├────┴──────────┴────────────────────────┴───────────────┤
 * │  StatusBar (h-8)                                       │
 * └────────────────────────────────────────────────────────┘
 *
 * The secondary panel (explorer, search, snapshots, patches) renders next to
 * the nav rail only when a panel is toggled; StudioSessionSidebar is always visible.
 */
export function CopilotStudioShell({
  repositoryId,
  repositories = [],
  isRepositoriesLoading = false,
}: CopilotStudioShellProps): React.JSX.Element {
  const { activeSessionId, setActiveSessionId } = useStudioStore();
  // Only load active (non-archived) sessions in the main sidebar list
  const sessionsQuery = useChatSessions(100, 0, undefined, undefined, false);
  const deleteMutation = useDeleteSessionMutation();
  const updateMutation = useUpdateSessionMutation();

  const sessions = React.useMemo(
    () => sessionsQuery.data?.items ?? [],
    [sessionsQuery.data?.items]
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[#0B0D14] text-foreground"
      data-studio-shell="phase-1"
    >
      <GlobalTopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 48px navigation rail */}
        <StudioNavRail />

        {/* Secondary panel — renders null when no panel is active */}
        <StudioSecondaryPanel />

        {/* Session list sidebar */}
        <StudioSessionSidebar
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          currentSessionId={activeSessionId}
          onSelectSession={(id) => setActiveSessionId(id)}
          onDeleteSession={(id) => deleteMutation.mutateAsync(id)}
          onNewSession={() => setActiveSessionId(null)}
          onRenameSession={(id, title) =>
            updateMutation.mutateAsync({ sessionId: id, payload: { session_title: title } })
          }
          onTogglePin={(id, isPinned) =>
            updateMutation.mutateAsync({ sessionId: id, payload: { is_pinned: isPinned } })
          }
          onArchiveSession={(id, isArchived) =>
            updateMutation.mutateAsync({ sessionId: id, payload: { is_archived: isArchived } })
          }
          repositoryId={repositoryId}
          repositories={repositories}
        />

        {/* Main canvas — chat mode in Phase 1; editor/diff arrive in Phase 2+ */}
        <StudioCanvas
          repositoryId={repositoryId}
          repositories={repositories}
          isRepositoriesLoading={isRepositoriesLoading}
        />

        {/* Right context panel — repo info, index status, scope */}
        <ContextPanel repositoryId={repositoryId} />
      </div>

      <StatusBar />
    </div>
  );
}
