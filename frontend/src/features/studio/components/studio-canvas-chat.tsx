"use client";

import * as React from "react";
import Link from "next/link";
import { FilePlus, Loader2, Send, StopCircle } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import type { useChat } from "@/features/chat/hooks/use-chat";
import { useUpdateSessionMutation } from "@/features/chat/hooks/use-chat";
import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import { useComposerMentions } from "@/features/chat/hooks/use-composer-mentions";
import { ChatMessageItemBubble } from "@/features/chat/components/chat-message-item-bubble";
import { ModeSelector } from "@/features/chat/components/mode-selector";
import { RepositoryContextHeader } from "@/features/chat/components/repository-context-header";
import { ComposerAttachments } from "@/features/chat/components/composer-attachments";
import { ComposerMentionMenu } from "@/features/chat/components/composer-mention-menu";
import {
  extractMentionPaths,
  mergeUnique,
  partitionMentionPaths,
  stripMentionTokens,
} from "@/features/chat/utils/composer-mention-utils";
import { cn } from "@/lib/utils";
import type { Repository } from "@/features/repositories/types/repository-types";
import type { ChatMode, ChatSession } from "@/features/chat/types/chat-types";
import { useStudioStore } from "@/features/studio/store/studio-store";

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

function normalizeSessionMode(raw?: string | null): ChatMode {
  const upper = (raw ?? "ASK").toUpperCase();
  if (upper === "PLAN" || upper === "ACT") return upper;
  return "ASK";
}

/** Studio chat surface — used in AI dock (V2) or legacy canvas. */
export function StudioCanvasChat({
  repositoryId,
  repositories: _repositories = [],
  isRepositoriesLoading = false,
  chat,
  sessions,
  variant = "canvas",
}: StudioCanvasChatProps) {
  const toast = useToast();
  const updateSession = useUpdateSessionMutation();
  const activeFilePath = useStudioStore((s) => s.activeFilePath);
  const editorTabs = useStudioStore((s) => s.editorTabs);
  const activeTabId = useStudioStore((s) => s.activeTabId);

  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<ChatMode>("ASK");
  const [caretIndex, setCaretIndex] = React.useState(0);
  const inputAreaRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
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

  const {
    scopePaths,
    attachedFiles,
    toggleScopePath,
    toggleAttachedFile,
    addMentionPath,
    updateScopeMetadata,
  } = useSessionScope(currentSessionId);

  const activeSession = sessions.find((s) => s.id === currentSessionId);

  React.useEffect(() => {
    if (activeSession?.session_mode) {
      setMode(normalizeSessionMode(activeSession.session_mode));
    }
  }, [activeSession?.id, activeSession?.session_mode]);

  const handleModeChange = React.useCallback(
    (next: ChatMode) => {
      setMode(next);
      if (currentSessionId) {
        updateSession.mutate({
          sessionId: currentSessionId,
          payload: { session_mode: next },
        });
      }
    },
    [currentSessionId, updateSession],
  );

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

  const historyErrorMessage =
    historyError instanceof Error ? historyError.message : historyError ? "Unable to load history." : "";

  const canSend = Boolean(repositoryId) && query.trim().length > 0 && !isSending;

  const {
    mention,
    suggestions,
    isLoading: mentionsLoading,
    selectSuggestion,
    moveSelection,
    dismiss,
  } = useComposerMentions(query, caretIndex, repositoryId);

  const handleMentionSelect = React.useCallback(
    (suggestion: { path: string; type: "FILE" | "DIRECTORY" }) => {
      const { nextText, nextCaret } = selectSuggestion(suggestion);
      setQuery(nextText);
      setCaretIndex(nextCaret);
      addMentionPath(suggestion.path, suggestion.type === "FILE");
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    },
    [selectSuggestion, addMentionPath],
  );

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = query.trim();
    setQuery("");
    setCaretIndex(0);

    const mentionPaths = extractMentionPaths(trimmed);
    const { scopePaths: mentionScope, attachedFiles: mentionAttached } =
      partitionMentionPaths(mentionPaths);
    const finalScopePaths = mergeUnique(scopePaths, mentionScope);
    const finalAttachedFiles = mergeUnique(attachedFiles, mentionAttached);

    if (mentionPaths.length > 0) {
      updateScopeMetadata(finalScopePaths, finalAttachedFiles);
    }

    const displayContent = stripMentionTokens(trimmed) || trimmed;

    try {
      await sendMessage(trimmed, mode, finalScopePaths, {
        displayContent,
        attachedFiles: finalAttachedFiles.length ? finalAttachedFiles : undefined,
      });
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        const message = error instanceof Error ? error.message : "Unable to send message.";
        toast.error("Chat Failed", message);
      }
    }
  };

  const handleAddOpenFile = React.useCallback(() => {
    const activeTab = editorTabs.find((t) => t.id === activeTabId);
    const path = activeTab?.kind === "file" ? activeTab.filePath : activeFilePath;
    if (!path) {
      toast.info("No file open", "Open a file in the editor to add it to context.");
      return;
    }
    addMentionPath(path, true);
    textareaRef.current?.focus();
  }, [editorTabs, activeTabId, activeFilePath, addMentionPath, toast]);

  const handleComposerDrop = React.useCallback(
    (event: React.DragEvent) => {
      const path =
        event.dataTransfer.getData("application/x-studio-path") ||
        event.dataTransfer.getData("text/plain");
      if (!path || path.includes("\n")) return;
      event.preventDefault();
      addMentionPath(path, path.includes("."));
    },
    [addMentionPath],
  );

  const isDock = variant === "dock";

  return (
    <main
      className={cn(
        "relative z-0 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#0B0D14]",
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
          activeSession?.session_title || activeSession?.summary || undefined
        }
        sessionTimestamp={
          activeSession?.last_activity_at || activeSession?.updated_at || activeSession?.created_at
        }
      />

      <div className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden">
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
                <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[#E2E8F0]">
                  How can I help you build today?
                </h2>
                <p className="max-w-md text-[15px] text-[#8B949E]">
                  Ask a question, plan a change, or use Act mode to generate patches.
                  Type <span className="font-mono text-[#58A6FF]">@</span> to reference files.
                </p>
                {!repositoryId && !isRepositoriesLoading && (
                  <Link
                    href="/dashboard"
                    className="pointer-events-auto mt-4 text-sm font-medium text-[#58A6FF] hover:underline"
                  >
                    Open a repository in Studio →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && !isHistoryLoading && isDock && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-[#8B949E]">
            Start a conversation — type @ to reference files from the explorer.
          </div>
        )}

        <div className="h-full w-full min-w-0 overflow-x-hidden">
          <Virtuoso
            data={messages}
            itemContent={(_, message) => (
              <ChatMessageItemBubble
                key={message.id}
                message={message}
                repositoryId={repositoryId}
              />
            )}
            className={cn(
              "h-full w-full min-w-0 overflow-x-hidden custom-scrollbar",
            )}
            alignToBottom
            followOutput="smooth"
            components={{
              Footer: () => <div style={{ height: Math.max(inputHeight, 120) }} aria-hidden />,
            }}
          />
        </div>
      </div>

      <div
        ref={inputAreaRef}
        className={cn(
          "shrink-0 min-w-0 border-t border-[#1E212B]/80 bg-[#0B0D14] px-3 pb-3 pt-2",
          !isDock && "md:px-8",
        )}
      >
        {!repositoryId ? (
          <div className="mx-auto rounded-xl border border-[#2D313E] bg-[#161822] px-4 py-6 text-center text-sm text-[#8B949E]">
            Open a repository in Studio to chat.{" "}
            <Link href="/dashboard" className="text-[#58A6FF] hover:underline">
              Go to dashboard
            </Link>
          </div>
        ) : (
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
                "group relative mx-auto flex w-full flex-col gap-0 rounded-xl border bg-[#161822] shadow-2xl transition-all",
                "border-[#2D313E] focus-within:border-[#3B82F6]/50 focus-within:ring-2 focus-within:ring-[#3B82F6]/10",
              )}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-studio-path")) {
                  e.preventDefault();
                }
              }}
              onDrop={handleComposerDrop}
            >
              <div className="flex flex-col gap-1 p-2 pt-2">
                <ModeSelector mode={mode} onModeChange={handleModeChange} variant="compact" />

                <ComposerAttachments
                  scopePaths={scopePaths}
                  attachedFiles={attachedFiles}
                  onRemoveScope={toggleScopePath}
                  onRemoveAttached={toggleAttachedFile}
                />

                <div className="relative overflow-visible px-1">
                  <ComposerMentionMenu
                    open={mention.active}
                    suggestions={suggestions}
                    selectedIndex={mention.selectedIndex}
                    isLoading={mentionsLoading}
                    onSelect={handleMentionSelect}
                    className="left-2 right-2 w-auto"
                  />
                  <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setCaretIndex(event.target.selectionStart ?? 0);
                      event.target.style.height = "auto";
                      event.target.style.height = `${Math.min(event.target.scrollHeight, 300)}px`;
                    }}
                    onSelect={(event) => {
                      setCaretIndex(event.currentTarget.selectionStart ?? 0);
                    }}
                    onKeyDown={(event) => {
                      if (mention.active && suggestions.length > 0) {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          moveSelection(1);
                          return;
                        }
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          moveSelection(-1);
                          return;
                        }
                        if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
                          event.preventDefault();
                          const picked = suggestions[mention.selectedIndex];
                          if (picked) handleMentionSelect(picked);
                          return;
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          dismiss();
                          return;
                        }
                      }
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Ask a question or type @ to reference files…"
                    rows={1}
                    disabled={!repositoryId}
                    className="max-h-[300px] min-h-[44px] w-full resize-none border-0 bg-transparent px-2 py-2.5 text-[14px] leading-relaxed text-[#E2E8F0] shadow-none placeholder:text-[#8B949E] focus-visible:outline-none focus:ring-0 custom-scrollbar"
                  />
                </div>

                <div className="mt-1 flex items-center justify-between border-t border-[#2D313E]/50 px-2 pb-1 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleAddOpenFile}
                      disabled={!repositoryId}
                      className="h-7 gap-1 px-2 text-[10px] text-[#8B949E] hover:text-[#C9D1D9]"
                      title="Add currently open editor file to context"
                    >
                      <FilePlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Add open file</span>
                    </Button>
                    <span className="hidden text-[10px] text-[#6E7681] md:inline">
                      @ files · Shift+Enter new line
                    </span>
                  </div>
                  <Button
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    size="sm"
                    className="h-8 rounded-md border-none bg-[#5CD4C2] px-5 font-bold tracking-wide text-black transition-colors hover:bg-[#4bc2b0]"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
