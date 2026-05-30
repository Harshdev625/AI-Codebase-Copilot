"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Loader2, MessageSquarePlus, Send, Trash2, StopCircle } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/toast-provider";
import {
  useChat,
  useChatSessions,
  useDeleteSessionMutation,
} from "@/features/chat/hooks/use-chat";
import type { ChatMessage } from "@/features/chat/types/chat-types";
import { ChatMessageItemBubble } from "./chat-message-item-bubble";
import { cn } from "@/lib/utils";

interface ChatWorkspaceProps {
  repositoryId?: string;
}

function toSourceLabels(message: ChatMessage): string[] {
  const sources = message.metadata?.sources;
  if (!Array.isArray(sources)) return [];
  
  return sources
    .map((source) => {
      if (!source || typeof source !== "object") return "";
      const record = source as Record<string, unknown>;
      const path = typeof record.path === "string" ? record.path : null;
      const repo =
        typeof record.repository_name === "string"
          ? record.repository_name
          : typeof record.repo_id === "string"
            ? record.repo_id
            : typeof record.repository_id === "string"
              ? record.repository_id
              : null;
      if (path && repo) return `${repo}: ${path}`;
      return path || repo || "";
    })
    .filter((label): label is string => Boolean(label));
}



export function ChatWorkspace({ repositoryId }: ChatWorkspaceProps) {
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const virtuosoRef = React.useRef<any>(null);

  const {
    messages,
    sendMessage,
    stopGeneration,
    isSending,
    isHistoryLoading,
    historyError,
    clearMessages,
    currentSessionId,
    selectSession,
  } = useChat({ repositoryId });

  const sessionsQuery = useChatSessions(40, 0);
  const deleteMutation = useDeleteSessionMutation();
  const sessions = sessionsQuery.data?.items ?? [];
  const historyErrorMessage =
    historyError instanceof Error ? historyError.message : historyError ? "Unable to load history." : "";



  const canSend = Boolean(repositoryId) && query.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = query.trim();
    setQuery("");
    try {
      await sendMessage(trimmed);
    } catch (error) {
      if ((error as any).name !== "AbortError") {
         const message = error instanceof Error ? error.message : "Unable to send message.";
         toast.error("Chat Failed", message);
      }
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteMutation.mutateAsync(sessionId);
      if (currentSessionId === sessionId) {
        clearMessages();
      }
      toast.success("Session Deleted", "Conversation removed from history.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete session.";
      toast.error("Delete Failed", message);
    }
  };

  const showDisabledBanner = !repositoryId;

  return (
    <div className="grid h-full w-full grid-cols-1 gap-0 lg:grid-cols-[280px_1fr]">
      {/* Sidebar - Sessions List */}
      <aside className="border-b border-border/60 bg-card/40 lg:border-b-0 lg:border-r backdrop-blur-md flex flex-col">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversations</p>
          <Button size="sm" variant="ghost" onClick={clearMessages} disabled={isSending} className="h-8 px-2 text-primary hover:bg-primary/10">
            <MessageSquarePlus className="mr-1.5 h-4 w-4" />
            New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {sessionsQuery.isLoading && (
            <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-3 text-xs text-muted-foreground text-center">
              Loading sessions...
            </div>
          )}

          {!sessionsQuery.isLoading && sessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-6 text-xs text-muted-foreground text-center">
              No saved sessions yet.
            </div>
          )}

          {sessions.map((session) => {
            const label = session.summary || session.title || "Untitled session";
            const active = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  "group relative rounded-xl border px-3 py-2.5 transition-all duration-200",
                  active
                    ? "border-primary/30 bg-primary/10 shadow-sm"
                    : "border-transparent bg-transparent hover:bg-card hover:border-border/60"
                )}
              >
                <button type="button" onClick={() => selectSession(session.id)} className="w-full text-left pr-6">
                  <p className={cn("truncate text-[13px] font-semibold transition-colors", active ? "text-primary" : "text-foreground")}>{label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground font-medium">
                    {new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => void handleDeleteSession(session.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex min-h-0 flex-col bg-background/50">
        <div className="min-h-0 flex-1 relative">
          {showDisabledBanner && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
               <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-8 text-center max-w-sm backdrop-blur-sm shadow-sm">
                 <p className="text-sm font-medium text-foreground mb-2">No Repository Selected</p>
                 <p className="text-xs text-muted-foreground">Select a repository from the top navigation to begin analyzing code.</p>
               </div>
            </div>
          )}

          {currentSessionId && isHistoryLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
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

          {!showDisabledBanner && messages.length === 0 && !isHistoryLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 shadow-glow-sm">
                <MessageSquarePlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">How can I help you?</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask questions about the architecture, request refactoring, or ask me to explain complex code paths in this repository.
              </p>
            </div>
          )}

          <div className="absolute inset-0 pt-6">
             <Virtuoso
                ref={virtuosoRef}
                data={messages}
                itemContent={(_, message) => <ChatMessageItemBubble key={message.id} message={message} />}
                className="h-full w-full custom-scrollbar"
                alignToBottom
                followOutput="smooth"
             />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border/40 bg-background/80 backdrop-blur-xl px-4 py-4 md:px-8 z-20 shrink-0">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 relative">
            
            {/* Status indicators */}
            <div className="absolute -top-10 right-0 flex items-center gap-2">
              {isSending && (
                <Button 
                   size="sm" 
                   variant="outline" 
                   onClick={stopGeneration}
                   className="h-8 rounded-full border-border/60 bg-background/80 text-xs font-semibold shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                >
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                  Stop generating
                </Button>
              )}
            </div>

            <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-card/50 shadow-sm focus-within:border-primary/50 focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10 transition-all">
              <Textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={showDisabledBanner ? "Select a repository to begin..." : "Ask a question about the codebase..."}
                className="min-h-[56px] max-h-[300px] flex-1 resize-none border-0 bg-transparent py-4 px-4 shadow-none focus-visible:ring-0 text-sm leading-relaxed custom-scrollbar"
              />
              <div className="p-2 shrink-0">
                <Button
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  size="icon"
                  className={cn("h-10 w-10 rounded-xl transition-all", canSend ? "bg-primary text-primary-foreground shadow-glow-sm hover:scale-105" : "bg-muted text-muted-foreground")}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-center text-[10px] font-medium text-muted-foreground/70">
              Press <kbd className="font-mono bg-muted/50 rounded px-1 py-0.5 border border-border/40">Enter</kbd> to send, <kbd className="font-mono bg-muted/50 rounded px-1 py-0.5 border border-border/40">Shift+Enter</kbd> for new line. AI can make mistakes.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}