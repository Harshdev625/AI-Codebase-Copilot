"use client";

import * as React from "react";
import { X } from "lucide-react";

import type { ChatSession } from "@/features/chat/types/chat-types";
import type { Repository } from "@/features/repositories/types/repository-types";
import { ContextPanel } from "@/features/chat/components/context-panel";
import type { useChat } from "@/features/chat/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StudioSessionSidebar } from "../components/studio-session-sidebar";
import { StudioCanvasChat } from "../components/studio-canvas-chat";

type StudioChatState = ReturnType<typeof useChat>;

export interface AiDockPanelProps {
  repositoryId?: string;
  repositories?: Repository[];
  isRepositoriesLoading?: boolean;
  chat: StudioChatState;
  sessions: ChatSession[];
  onClose?: () => void;
  className?: string;
}

export function AiDockPanel({
  repositoryId,
  repositories = [],
  isRepositoriesLoading = false,
  chat,
  sessions,
  onClose,
  className,
}: AiDockPanelProps): React.JSX.Element {
  const sidebarProps = {
    sessions,
    sessionsLoading: false,
    isLoading: false,
    currentSessionId: chat.currentSessionId,
    repositories,
    repositoryId,
    onSelectSession: chat.selectSession,
    onDeleteSession: async () => {},
    onNewSession: chat.clearMessages,
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-l border-[#1E212B] bg-[#0B0D14]",
        className,
      )}
      data-testid="ai-dock-panel"
      aria-label="AI Assistant"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#1E212B] bg-[#13151A] px-3">
        <span className="text-xs font-semibold text-[#C9D1D9]">AI Assistant</span>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#8B949E]"
            onClick={onClose}
            aria-label="Close AI panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden w-[220px] shrink-0 border-r border-[#1E212B] xl:flex xl:flex-col">
          <StudioSessionSidebar {...sidebarProps} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <StudioCanvasChat
              variant="dock"
              repositoryId={repositoryId}
              repositories={repositories}
              isRepositoriesLoading={isRepositoriesLoading}
              chat={chat}
              sessions={sessions}
            />
          </div>
          <div className="hidden max-h-[200px] shrink-0 overflow-hidden border-t border-[#1E212B] lg:block">
            <ContextPanel repositoryId={repositoryId} />
          </div>
        </div>
      </div>
    </aside>
  );
}
