"use client";

import * as React from "react";
import Link from "next/link";
import {
  Loader2,
  Send,
  StopCircle,
  Database,
  GitBranch,
  ChevronDown,
  Check,
} from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { partialRetrievalTitle } from "@/features/notifications/notification-copy";
import { notifyWarning } from "@/features/notifications/utils/notify";
import type { useChat } from "@/features/chat/hooks/use-chat";
import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import { ChatMessageItemBubble } from "@/features/chat/components/chat-message-item-bubble";
import { ModeSelector } from "@/features/chat/components/mode-selector";
import { RepositoryContextHeader } from "@/features/chat/components/repository-context-header";
import { ScopeSelector } from "@/features/chat/components/scope-selector";
import { cn } from "@/lib/utils";
import type { Repository } from "@/features/repositories/types/repository-types";
import { MultiRepositorySelect } from "@/features/chat/components/multi-repository-select";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { buildFederatedChatQuery, normalizeRepoPath, FEDERATED_CONTEXT_PREFIX } from "@/features/chat/utils/chat-message-utils";
import type { ChatMode, ChatSession } from "@/features/chat/types/chat-types";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useAuthStore } from "@/store/auth-store";
import {
  readFederatedRepoIds,
  writeFederatedRepoIds,
} from "@/features/studio/utils/federated-scope-storage";

type StudioChatState = ReturnType<typeof useChat>;

interface StudioCanvasChatProps {
  repositoryId?: string;
  repositories?: Repository[];
  isRepositoriesLoading?: boolean;
  chat: StudioChatState;
  sessions: ChatSession[];
  /** dock = AI panel (full width, compact empty state) */
  variant?: "canvas" | "dock";
}

function sendLabelForMode(mode: ChatMode): string {
  switch (mode) {
    case "ACT":
      return "Act";
    case "PLAN":
      return "Plan";
    default:
      return "Ask";
  }
}

/** Studio chat surface — used in AI dock (V2) or legacy canvas. */
export function StudioCanvasChat({
  repositoryId,
  repositories = [],
  isRepositoriesLoading = false,
  chat,
  sessions,
  variant = "canvas",
}: StudioCanvasChatProps) {
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id);
  const { setSelectedRepositoryId } = useStudioStore();
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<ChatMode>("ASK");
  const [selectedRepoIds, setSelectedRepoIds] = React.useState<string[]>([]);
  const [repoPickerOpen, setRepoPickerOpen] = React.useState(false);
  const repoPickerRef = React.useRef<HTMLDivElement>(null);
  const inputAreaRef = React.useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = React.useState(180);

  const {
    messages,
    sendMessage,
    stopGeneration,
    isSending,
    isHistoryLoading,
    historyError,
    currentSessionId,
  } = chat;

  const { scopePaths, setScopePaths } = useSessionScope(currentSessionId);

  const selectedRepo = repositories.find((r) => r.id === repositoryId);
  const branchLabel = selectedRepo?.default_branch || "main";

  React.useEffect(() => {
    if (!userId) return;
    const stored = readFederatedRepoIds(userId);
    if (stored.length > 0) {
      setSelectedRepoIds(stored);
    }
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    writeFederatedRepoIds(userId, selectedRepoIds);
  }, [userId, selectedRepoIds]);

  React.useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setInputHeight(el.offsetHeight);
    });
    observer.observe(el);
    setInputHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (repoPickerRef.current && !repoPickerRef.current.contains(event.target as Node)) {
        setRepoPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const historyErrorMessage =
    historyError instanceof Error ? historyError.message : historyError ? "Unable to load history." : "";

  const canSend = (Boolean(repositoryId) || selectedRepoIds.length > 0) && query.trim().length > 0 && !isSending;

  const handleFederatedChange = (ids: string[]) => {
    setSelectedRepoIds(ids);
    if (ids.length > 0 && !repositoryId) {
      setSelectedRepositoryId(ids[0]);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = query.trim();
    setQuery("");
    try {
      const needsClientFederatedContext =
        selectedRepoIds.length > 1 ||
        (selectedRepoIds.length === 1 && selectedRepoIds[0] !== repositoryId);

      if (needsClientFederatedContext) {
        toast.info("Retrieving Federated Context", `Querying ${selectedRepoIds.length} repositories...`);
        const allResults = await Promise.allSettled(
          selectedRepoIds.map((rid) =>
            repositoryService.retrieveRepository(rid, { query: trimmed, top_k: 4 })
          )
        );

        let formattedContext = FEDERATED_CONTEXT_PREFIX;
        let idx = 0;
        let failedRepos = 0;
        allResults.forEach((result) => {
          if (result.status === "fulfilled") {
            result.value.items?.forEach((item) => {
              idx++;
              const displayScore = item.rerank_score !== undefined ? item.rerank_score : item.score;
              const displayPath = normalizeRepoPath(item.path);
              formattedContext += `[Source #${idx}] File: ${displayPath} (Repository: ${item.repository_id})\n`;
              formattedContext += `Symbol: ${item.symbol || "unknown"}\n`;
              formattedContext += `Score: ${(displayScore * 100).toFixed(1)}%\n`;
              formattedContext += "```\n" + item.content + "\n```\n\n";
            });
          } else {
            failedRepos += 1;
          }
        });
        if (failedRepos > 0) {
          const message = `${failedRepos} of ${selectedRepoIds.length} repositories failed retrieval.`;
          toast.error(partialRetrievalTitle(), message);
          notifyWarning(partialRetrievalTitle(), message, { kind: 'studio' });
        }
        if (idx === 0) {
          formattedContext += "(No matching snippets retrieved across repositories)\n\n";
        }

        const finalQuery = buildFederatedChatQuery(formattedContext, trimmed);
        await sendMessage(finalQuery, mode, scopePaths, { displayContent: trimmed });
      } else {
        await sendMessage(trimmed, mode, scopePaths);
      }
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        const message = error instanceof Error ? error.message : "Unable to send message.";
        toast.error("Chat Failed", message);
      }
    }
  };

  const isDock = variant === "dock";
  const sendLabel = sendLabelForMode(mode);

  return (
    <main
      className={cn(
        "relative z-0 flex min-h-0 flex-1 flex-col bg-[#0B0D14]",
        isDock && "h-full",
      )}
      aria-live="polite"
      aria-label="Chat messages"
    >
      <RepositoryContextHeader
        repositoryId={repositoryId}
        mode={mode}
        scopePaths={scopePaths}
        sessionTitle={
          sessions.find((s) => s.id === currentSessionId)?.session_title ||
          sessions.find((s) => s.id === currentSessionId)?.summary ||
          undefined
        }
      />

      <div className="relative min-h-0 flex-1">
        {currentSessionId && isHistoryLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Restoring conversation...
            </div>
          </div>
        )}

        {currentSessionId && historyErrorMessage && (
          <div className="m-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {historyErrorMessage}
          </div>
        )}

        {messages.length === 0 && !isHistoryLoading && !isDock && (
          <div className="pointer-events-none absolute inset-0 flex justify-center overflow-y-auto p-6 md:p-8">
            <div className="mt-10 flex w-full max-w-4xl flex-col gap-6 pb-8">
              <div className="mt-20 flex flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2D313E] bg-[#1A1C23] shadow-lg">
                  <Database className="h-8 w-8 text-[#58A6FF]" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[#E2E8F0]">
                  How can I help you build today?
                </h2>
                <p className="max-w-md text-[15px] text-[#8B949E]">
                  Describe your task, ask a question, or select a mode to get started.
                </p>
                {!repositoryId && !isRepositoriesLoading && (
                  <Link
                    href="/dashboard"
                    className="pointer-events-auto mt-4 text-sm font-medium text-[#58A6FF] hover:underline"
                  >
                    Add a repository on the dashboard →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && !isHistoryLoading && isDock && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-[#8B949E]">
            Start a conversation — ask about your codebase, plan a change, or run Act mode.
          </div>
        )}

        <Virtuoso
          data={messages}
          itemContent={(_, message) => (
            <ChatMessageItemBubble
              key={message.id}
              message={message}
              mode={mode}
              repositoryId={repositoryId}
            />
          )}
          className={cn("h-full w-full custom-scrollbar px-3", !isDock && "md:px-6")}
          alignToBottom
          followOutput="smooth"
          components={{
            Footer: () => <div style={{ height: Math.max(inputHeight, 120) }} aria-hidden />,
          }}
        />
      </div>

      <div
        ref={inputAreaRef}
        className={cn(
          "shrink-0 border-t border-[#1E212B]/80 bg-[#0B0D14] px-3 pb-3 pt-2",
          !isDock && "md:px-8",
        )}
      >
        <div className="relative flex w-full flex-col gap-2">
          {isSending && (
            <div className="mb-2 flex justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={stopGeneration}
                className="h-8 rounded-full border-[#2D313E] bg-[#1A1C23] text-xs font-semibold text-[#C9D1D9] shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                Stop generating
              </Button>
            </div>
          )}

          <div
            className={cn(
              "group relative mx-auto flex w-full flex-col gap-0 overflow-hidden rounded-xl border bg-[#161822] shadow-2xl transition-all",
              "border-[#2D313E] focus-within:border-[#3B82F6]/50 focus-within:ring-2 focus-within:ring-[#3B82F6]/10"
            )}
          >
            <div className="flex flex-col gap-2 p-2 pt-3">
              <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
                <ModeSelector mode={mode} onModeChange={setMode} />

                <div className="ml-2 flex flex-wrap items-center gap-2">
                  <div className="relative" ref={repoPickerRef}>
                    <button
                      type="button"
                      onClick={() => setRepoPickerOpen((v) => !v)}
                      className="flex items-center gap-1.5 rounded-md border border-[#2D313E] bg-[#1A1C23] px-2 py-1 text-[11px] font-medium text-[#C9D1D9] transition-colors hover:border-[#444D56]"
                      title="Select primary repository"
                    >
                      <Database className="h-3 w-3 text-[#8B949E]" />
                      {selectedRepo?.repo_id?.split("/").pop() || "No repo"}
                      <ChevronDown className="h-3 w-3 text-[#8B949E]" />
                    </button>
                    {repoPickerOpen && (
                      <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[220px] w-[260px] overflow-y-auto rounded-lg border border-[#2D313E] bg-[#161B22] py-1 shadow-xl">
                        {repositories.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[#8B949E]">No repositories available.</p>
                        ) : (
                          repositories.map((repo) => (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => {
                                setSelectedRepositoryId(repo.id);
                                setRepoPickerOpen(false);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#C9D1D9] hover:bg-[#1F242D]"
                            >
                              {repositoryId === repo.id ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[#58A6FF]" />
                              ) : (
                                <span className="w-3.5 shrink-0" />
                              )}
                              <span className="truncate">{repo.repo_id}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <MultiRepositorySelect
                    repositories={repositories}
                    selectedIds={selectedRepoIds}
                    onChange={handleFederatedChange}
                  />

                  <div className="flex items-center gap-1.5 rounded-md border border-[#2D313E] bg-[#1A1C23] px-2 py-1 text-[11px] font-medium text-[#C9D1D9]">
                    <GitBranch className="h-3 w-3 text-[#8B949E]" /> {branchLabel}
                  </div>

                  <ScopeSelector scopePaths={scopePaths} onChange={setScopePaths} />
                </div>
              </div>

              <div className="relative flex items-end gap-2 px-1 pb-1 pt-1">
                <div className="absolute left-3 top-2 flex items-center justify-center text-[#8B949E]">
                  <div className="flex h-5 w-5 items-center justify-center rounded border border-[#2D313E] bg-[#1A1C23] text-[10px] font-bold text-[#58A6FF]">
                    {sendLabel.slice(0, 1)}
                  </div>
                </div>
                <textarea
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    event.target.style.height = "auto";
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 300)}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Describe the changes, ask a question, or reference files..."
                  rows={1}
                  className="max-h-[300px] min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2.5 pl-11 pr-3 text-[14px] leading-relaxed text-[#E2E8F0] shadow-none placeholder:text-[#8B949E] focus-visible:outline-none focus:ring-0 custom-scrollbar"
                />
              </div>

              <div className="mt-1 flex items-center justify-end border-t border-[#2D313E]/50 px-2 pb-1 pt-2">
                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-1.5 text-[10px] text-[#8B949E] sm:flex">
                    <kbd className="rounded border border-[#2D313E] bg-[#1A1C23] px-1.5 py-0.5 font-sans font-semibold">
                      ↵
                    </kbd>{" "}
                    Send
                  </div>
                  <Button
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    size="sm"
                    className="h-8 rounded-md border-none bg-[#5CD4C2] px-5 font-bold tracking-wide text-black transition-colors hover:bg-[#4bc2b0]"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {sendLabel}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
