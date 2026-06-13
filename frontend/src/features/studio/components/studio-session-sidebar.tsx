"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  MessageSquare,
  Search,
  Edit,
  PenTool,
  Plus,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Pin,
  PinOff,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/features/chat/types/chat-types";
import type { Repository } from "@/features/repositories/types/repository-types";
import { useChatSessions } from "@/features/chat/hooks/use-chat";

interface StudioSessionSidebarProps {
  sessions: ChatSession[];
  isLoading: boolean;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession?: (id: string, title: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onArchiveSession?: (id: string, isArchived: boolean) => void;
  repositoryId?: string;
  repositories?: Repository[];
}

function groupSessionsByRepo(sessions: ChatSession[], repositories: Repository[]) {
  const grouped: Record<string, ChatSession[]> = {};
  const noRepo: ChatSession[] = [];

  sessions.forEach((session) => {
    let repoName = "Unassigned";
    if (session.metadata?.repository) {
      repoName = session.metadata.repository.split("/").pop() || "Unknown";
    } else if (session.repository_id) {
      const r = repositories.find((r) => r.id === session.repository_id);
      repoName = r ? r.repo_id.split("/").pop() || r.repo_id : "Unknown";
    }

    if (repoName === "Unassigned") {
      noRepo.push(session);
    } else {
      if (!grouped[repoName]) grouped[repoName] = [];
      grouped[repoName].push(session);
    }
  });

  return { grouped, noRepo };
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onArchive,
  onRename,
  onTogglePin,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onArchive?: (isArchived: boolean) => void;
  onRename?: (title: string) => void;
  onTogglePin?: (isPinned: boolean) => void;
}) {
  const label = session.session_title || session.summary || "Untitled session";
  const mode = session.session_mode || "ASK";
  const isArchived = session.is_archived;
  const isPinned = session.is_pinned;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.session_title || session.summary || "");
    setIsEditing(true);
  };

  const handleRenameCommit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label && onRename) onRename(trimmed);
    setIsEditing(false);
  };

  const handleRenameCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEditing(false);
  };

  let Icon = MessageSquare;
  if (mode === "PLAN") Icon = Edit;
  if (mode === "ACT") Icon = PenTool;

  return (
    <div
      onClick={isEditing ? undefined : onSelect}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg p-2 cursor-pointer transition-all duration-150 border",
        isActive
          ? "bg-[#252833] border-[#3B4050]"
          : "bg-transparent border-transparent hover:bg-[#1A1C23] hover:border-[#2D313E]/50",
        isEditing && "cursor-default"
      )}
    >
      <div className="shrink-0 pt-0.5">
        <div className={cn(
          "w-7 h-7 rounded-md border flex items-center justify-center transition-colors",
          isPinned
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-[#1F222C] border-[#2D313E] text-[#8B949E]"
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCommit();
                if (e.key === "Escape") handleRenameCancel();
              }}
              className="flex-1 min-w-0 bg-[#0B0D14] border border-[#3B82F6] rounded px-1.5 py-0.5 text-[12px] text-[#C9D1D9] outline-none"
            />
            <button
              onClick={handleRenameCommit}
              className="text-green-500 hover:text-green-400 p-0.5 shrink-0"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={handleRenameCancel}
              className="text-[#8B949E] hover:text-[#C9D1D9] p-0.5 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <p className="text-[#C9D1D9] text-[12px] font-medium leading-snug truncate">{label}</p>
        )}
        {!isEditing && (
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[#8B949E] text-[10px] shrink-0">
              {format(new Date(session.last_activity_at || session.updated_at), "MMM d, h:mm a")}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {onRename && (
                <button
                  title="Rename session"
                  onClick={handleRenameStart}
                  className="h-5 w-5 flex items-center justify-center text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#2D313E] rounded transition-colors"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
              {onTogglePin && (
                <button
                  title={isPinned ? "Unpin session" : "Pin session"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(!isPinned);
                  }}
                  className="h-5 w-5 flex items-center justify-center text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#2D313E] rounded transition-colors"
                >
                  {isPinned ? <PinOff className="w-2.5 h-2.5" /> : <Pin className="w-2.5 h-2.5" />}
                </button>
              )}
              {onArchive && (
                <button
                  title={isArchived ? "Unarchive session" : "Archive session"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(!isArchived);
                  }}
                  className="h-5 w-5 flex items-center justify-center text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#2D313E] rounded transition-colors"
                >
                  {isArchived ? <ArchiveRestore className="w-2.5 h-2.5" /> : <Archive className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FolderGroup({
  title,
  sessions,
  currentSessionId,
  onSelectSession,
  onArchiveSession,
  onRenameSession,
  onTogglePinSession,
}: {
  title: string;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onArchiveSession?: (id: string, isArchived: boolean) => void;
  onRenameSession?: (id: string, title: string) => void;
  onTogglePinSession?: (id: string, isPinned: boolean) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  if (sessions.length === 0) return null;

  return (
    <div className="mb-3">
      <div
        className="flex items-center gap-2 px-1 mb-1.5 cursor-pointer group"
        onClick={() => setCollapsed((v) => !v)}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "text-[#8B949E] transition-transform",
            collapsed ? "-rotate-90" : "rotate-0"
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-[#8B949E] text-[11px] font-semibold tracking-wider uppercase truncate">
          {title}
        </span>
        <span className="text-[#8B949E] text-[10px] ml-auto shrink-0">{sessions.length}</span>
      </div>
      {!collapsed && (
        <div className="space-y-0.5 pl-1">
          {sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === currentSessionId}
              onSelect={() => onSelectSession(s.id)}
              onArchive={onArchiveSession ? (v) => onArchiveSession(s.id, v) : undefined}
              onRename={onRenameSession ? (title) => onRenameSession(s.id, title) : undefined}
              onTogglePin={onTogglePinSession ? (v) => onTogglePinSession(s.id, v) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudioSessionSidebar({
  sessions,
  isLoading,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onTogglePin,
  onArchiveSession,
  repositoryId,
  repositories = [],
}: StudioSessionSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);

  const archivedQuery = useChatSessions(50, 0, undefined, undefined, true);
  const archivedSessions: ChatSession[] = archivedQuery.data?.items ?? [];

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lq = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      (s.session_title || s.summary || "").toLowerCase().includes(lq)
    );
  }, [sessions, searchQuery]);

  const filteredArchived = React.useMemo(() => {
    if (!searchQuery.trim()) return archivedSessions;
    const lq = searchQuery.toLowerCase();
    return archivedSessions.filter((s) =>
      (s.session_title || s.summary || "").toLowerCase().includes(lq)
    );
  }, [archivedSessions, searchQuery]);

  const { grouped: groupedByRepo, noRepo } = React.useMemo(
    () => groupSessionsByRepo(filteredSessions, repositories),
    [filteredSessions, repositories]
  );

  const pinnedSessions = React.useMemo(
    () => filteredSessions.filter((s) => s.is_pinned),
    [filteredSessions]
  );
  const unpinnedSessions = React.useMemo(
    () => ({ grouped: groupedByRepo, noRepo }),
    [groupedByRepo, noRepo]
  );

  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-[#13151A] border-r border-[#1E212B]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <span className="text-[#8B949E] text-[10px] font-bold tracking-widest uppercase">Sessions</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewSession}
          className="h-6 w-6 text-[#8B949E] hover:text-white hover:bg-[#1A1C23]"
          title="New session"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#8B949E] pointer-events-none" />
          <Input
            placeholder="Search sessions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 pr-3 text-[12px] bg-[#1A1C23] border-[#2D313E] text-[#C9D1D9] focus-visible:ring-1 focus-visible:ring-[#3B82F6] rounded-md placeholder:text-[#8B949E]"
          />
        </div>
      </div>

      {!repositoryId && (
        <div className="mx-3 mb-3 rounded-lg border border-[#2D313E] bg-[#1A1C23] px-3 py-2.5 text-center">
          <p className="text-[11px] text-[#8B949E]">No repository selected.</p>
          <Link href="/dashboard" className="mt-1 inline-block text-[11px] font-medium text-[#58A6FF] hover:underline">
            Add repository on dashboard →
          </Link>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
        {isLoading && (
          <div className="space-y-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[#1A1C23] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && sessions.length === 0 && !currentSessionId && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#8B949E]/40" />
            <p className="text-[#8B949E] text-[12px]">No sessions yet.</p>
            <button
              onClick={onNewSession}
              className="text-[11px] text-[#3B82F6] hover:underline"
            >
              Start a new session →
            </button>
          </div>
        )}

        {/* Pinned sessions section */}
        {pinnedSessions.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <Pin className="w-2.5 h-2.5 text-[#8B949E]" />
              <span className="text-[#8B949E] text-[11px] font-semibold tracking-wider uppercase">Pinned</span>
            </div>
            <div className="space-y-0.5 pl-1">
              {pinnedSessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  isActive={s.id === currentSessionId}
                  onSelect={() => onSelectSession(s.id)}
                  onArchive={onArchiveSession ? (v) => onArchiveSession(s.id, v) : undefined}
                  onRename={onRenameSession ? (title) => onRenameSession(s.id, title) : undefined}
                  onTogglePin={onTogglePin ? (v) => onTogglePin(s.id, v) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Grouped sessions */}
        {Object.entries(unpinnedSessions.grouped).map(([repoName, repoSessions]) => (
          <FolderGroup
            key={repoName}
            title={repoName}
            sessions={repoSessions.filter((s) => !s.is_pinned)}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onArchiveSession={onArchiveSession}
            onRenameSession={onRenameSession}
            onTogglePinSession={onTogglePin}
          />
        ))}
        {unpinnedSessions.noRepo.filter((s) => !s.is_pinned).length > 0 && (
          <FolderGroup
            title="Recent"
            sessions={unpinnedSessions.noRepo.filter((s) => !s.is_pinned)}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectSession}
            onArchiveSession={onArchiveSession}
            onRenameSession={onRenameSession}
            onTogglePinSession={onTogglePin}
          />
        )}

        {/* Archived sessions */}
        {(archivedSessions.length > 0 || archivedQuery.isLoading) && (
          <div className="mt-3 border-t border-[#1E212B] pt-3">
            <button
              className="flex items-center gap-2 w-full px-1 mb-1.5 text-left"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="w-3 h-3 text-[#8B949E]" />
              <span className="text-[#8B949E] text-[11px] font-semibold tracking-wider uppercase flex-1">
                Archived {archivedSessions.length > 0 && `(${archivedSessions.length})`}
              </span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-[#8B949E] transition-transform",
                  showArchived && "rotate-180"
                )}
              />
            </button>

            {showArchived && (
              <div className="space-y-0.5 pl-1">
                {archivedQuery.isLoading ? (
                  <div className="text-[#8B949E] text-[11px] py-2 text-center">Loading…</div>
                ) : filteredArchived.length === 0 ? (
                  <div className="text-[#8B949E] text-[11px] py-2 text-center italic">No archived sessions.</div>
                ) : (
                  filteredArchived.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      onSelect={() => onSelectSession(s.id)}
                      onArchive={onArchiveSession ? (v) => onArchiveSession(s.id, v) : undefined}
                      onRename={onRenameSession ? (title) => onRenameSession(s.id, title) : undefined}
                      onTogglePin={onTogglePin ? (v) => onTogglePin(s.id, v) : undefined}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
