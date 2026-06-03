"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Loader2, MessageSquarePlus, Send, Trash2, StopCircle, Database, Search, PenTool, PlayCircle, RefreshCw, GitBranch, CheckCircle2 } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/toast-provider";
import {
  useChat,
  useChatSessions,
  useDeleteSessionMutation,
  useUpdateSessionMutation,
} from "@/features/chat/hooks/use-chat";
import type { ChatMessage, ChatMode } from "@/features/chat/types/chat-types";
import { ChatMessageItemBubble } from "./chat-message-item-bubble";
import { ModeSelector } from "./mode-selector";
import { RepositoryContextHeader } from "./repository-context-header";
import { ChatSessionSidebar } from "./chat-session-sidebar";
import { ContextPanel } from "./context-panel";
import { ScopeSelector } from "./scope-selector";
import { cn } from "@/lib/utils";
import type { Repository } from "@/features/repositories/types/repository-types";

interface ChatWorkspaceProps {
  repositoryId?: string;
  repositories?: Repository[];
  onRepositoryChange?: (id: string) => void;
  isRepositoriesLoading?: boolean;
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



export function ChatWorkspace({ 
  repositoryId, 
  repositories = [], 
  onRepositoryChange,
  isRepositoriesLoading = false
}: ChatWorkspaceProps) {
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<ChatMode>("ASK");
  const [scopePaths, setScopePaths] = React.useState<string[]>([]);
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

  const sessionsQuery = useChatSessions(100, 0);
  const deleteMutation = useDeleteSessionMutation();
  const updateSessionMutation = useUpdateSessionMutation();
  const sessions = sessionsQuery.data?.items ?? [];
  const historyErrorMessage =
    historyError instanceof Error ? historyError.message : historyError ? "Unable to load history." : "";



  const canSend = Boolean(repositoryId) && query.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = query.trim();
    setQuery("");
    try {
      await sendMessage(trimmed, mode, scopePaths);
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

  const handleTogglePin = async (sessionId: string, isPinned: boolean) => {
    try {
      await updateSessionMutation.mutateAsync({ sessionId, payload: { is_pinned: isPinned } });
    } catch (error) {
      toast.error("Update Failed", "Unable to update session pin status.");
    }
  };

  const showDisabledBanner = !repositoryId;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      
      {/* Left Panel: Unified Workspace Sidebar */}
      <div className="hidden lg:flex w-[280px] flex-col border-r border-border/40 bg-card/20 z-10">
        <ChatSessionSidebar
          sessions={sessions as any[]}
          isLoading={sessionsQuery.isLoading}
          currentSessionId={currentSessionId}
          onSelectSession={selectSession}
          onDeleteSession={handleDeleteSession}
          onNewSession={clearMessages}
          onTogglePin={handleTogglePin}
          isSending={isSending}
          repositoryId={repositoryId}
          repositories={repositories}
          onRepositoryChange={onRepositoryChange}
          isRepositoriesLoading={isRepositoriesLoading}
        />
      </div>

      {/* Center: Main Canvas */}
      <main className="flex min-h-0 flex-1 flex-col bg-background relative z-0">
        <RepositoryContextHeader repositoryId={repositoryId} mode={mode} scopePaths={scopePaths} />
        
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
            <div className="absolute inset-0 flex justify-center overflow-y-auto custom-scrollbar p-6 md:p-8">
              <div className="flex flex-col max-w-4xl w-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
                
                {/* Repository Dashboard Header */}
                <div className="flex flex-col mb-4">
                  <div className="flex items-center gap-3 text-2xl font-bold text-foreground tracking-tight">
                    <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 shadow-glow-sm">
                      <Database className="h-6 w-6 text-primary drop-shadow-sm" />
                    </div>
                    {repositories?.find(r => r.id === repositoryId)?.repo_id || "Active Workspace"}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 px-2 py-1 rounded-md border border-border/30">
                      <GitBranch className="w-3 h-3" /> main
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-md border border-success/20">
                      <CheckCircle2 className="w-3 h-3" /> Indexed (2h ago)
                    </span>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs font-mono text-muted-foreground">1,245 files</span>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs font-mono text-muted-foreground">8,420 chunks</span>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Suggested Work (Takes 8 columns) */}
                  <div className="lg:col-span-8 flex flex-col gap-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">Suggested Work</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* ASK */}
                      <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs tracking-tight">
                          <Search className="w-3.5 h-3.5" /> ASK
                        </div>
                        <button onClick={() => { setMode("ASK"); setQuery("Explain authentication flow"); }} className="text-left text-[13px] text-foreground/80 hover:text-blue-400 transition-colors font-medium">Explain auth flow</button>
                        <button onClick={() => { setMode("ASK"); setQuery("Find API routes"); }} className="text-left text-[13px] text-foreground/80 hover:text-blue-400 transition-colors font-medium">Find API routes</button>
                        <button onClick={() => { setMode("ASK"); setQuery("Trace payment flow"); }} className="text-left text-[13px] text-foreground/80 hover:text-blue-400 transition-colors font-medium">Trace payment flow</button>
                      </div>
                      
                      {/* PLAN */}
                      <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
                        <div className="flex items-center gap-2 text-purple-500 font-bold text-xs tracking-tight">
                          <PenTool className="w-3.5 h-3.5" /> PLAN
                        </div>
                        <button onClick={() => { setMode("PLAN"); setQuery("Design RBAC system"); }} className="text-left text-[13px] text-foreground/80 hover:text-purple-400 transition-colors font-medium">Design RBAC</button>
                        <button onClick={() => { setMode("PLAN"); setQuery("Improve architecture"); }} className="text-left text-[13px] text-foreground/80 hover:text-purple-400 transition-colors font-medium">Improve architecture</button>
                        <button onClick={() => { setMode("PLAN"); setQuery("Create indexing strategy"); }} className="text-left text-[13px] text-foreground/80 hover:text-purple-400 transition-colors font-medium">Create indexing strategy</button>
                      </div>

                      {/* ACT */}
                      <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/60 transition-colors sm:col-span-2">
                        <div className="flex items-center gap-2 text-amber-500 font-bold text-xs tracking-tight">
                          <PlayCircle className="w-3.5 h-3.5" /> ACT
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setMode("ACT"); setQuery("Generate tests for User Model"); }} className="text-left text-[13px] text-foreground/80 hover:text-amber-400 transition-colors font-medium">Generate tests</button>
                          <button onClick={() => { setMode("ACT"); setQuery("Create endpoint"); }} className="text-left text-[13px] text-foreground/80 hover:text-amber-400 transition-colors font-medium">Create endpoint</button>
                          <button onClick={() => { setMode("ACT"); setQuery("Refactor service"); }} className="text-left text-[13px] text-foreground/80 hover:text-amber-400 transition-colors font-medium">Refactor service</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Continue Working / Rail (Takes 4 columns) */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">Workspace Rail</h4>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors cursor-pointer group border border-transparent hover:border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-500/10 p-1.5 rounded-lg text-purple-500">
                            <PenTool className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-foreground/90 group-hover:text-purple-400 transition-colors">Refactor Auth Flow</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">PLAN • 2 hours ago</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors cursor-pointer group border border-transparent hover:border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-500/10 p-1.5 rounded-lg text-amber-500">
                            <PlayCircle className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-foreground/90 group-hover:text-amber-400 transition-colors">Create User Endpoint</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">ACT • Yesterday</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-colors cursor-pointer group border border-transparent hover:border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted p-1.5 rounded-lg text-muted-foreground">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-foreground/90 group-hover:text-primary transition-colors">Repository Synced</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">System • 3 hours ago</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          <div className="absolute inset-0 pt-6">
             <Virtuoso
                ref={virtuosoRef}
                data={messages}
                itemContent={(_, message) => <ChatMessageItemBubble key={message.id} message={message} mode={mode} />}
                className="h-full w-full custom-scrollbar"
                alignToBottom
                followOutput="smooth"
             />
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-6 px-4 md:px-12 z-20 pointer-events-none">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 relative pointer-events-auto">
            
            {/* Status indicators */}
            <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
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

            <div className={cn(
              "relative flex flex-col gap-0 rounded-2xl border bg-card/70 backdrop-blur-2xl transition-all overflow-hidden group mx-auto w-full",
              "shadow-[0_20px_60px_-10px_rgba(0,0,0,0.4)]",
              mode === "ASK" ? "border-blue-500/30 focus-within:border-blue-500/60 focus-within:ring-4 focus-within:ring-blue-500/10" :
              mode === "PLAN" ? "border-purple-500/30 focus-within:border-purple-500/60 focus-within:ring-4 focus-within:ring-purple-500/10" :
              "border-amber-500/30 focus-within:border-amber-500/60 focus-within:ring-4 focus-within:ring-amber-500/10"
            )}>
              <div className="flex flex-col gap-2 p-2 pt-3">
                <ModeSelector mode={mode} onModeChange={setMode} />
                
                {/* Integrated Repository Intelligence Chips */}
                <div className="flex items-center gap-2 px-3 pt-1 pb-2 border-b border-border/30">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/30">
                    <Database className="w-3 h-3" /> {repositories?.find(r => r.id === repositoryId)?.repo_id || "No repo"}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/30">
                    <GitBranch className="w-3 h-3" /> main
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                    <CheckCircle2 className="w-3 h-3" /> Indexed
                  </div>
                  <ScopeSelector scopePaths={scopePaths} onChange={setScopePaths} />
                </div>

                <div className="flex items-end gap-2 pt-1">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
                      }
                    }}
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
                    placeholder={
                      showDisabledBanner ? "Select a repository to begin..." 
                      : mode === "PLAN" ? "Describe a feature or architectural change to plan..." 
                      : mode === "ACT" ? "Describe the code modifications to apply..." 
                      : "Ask a question about the codebase..."
                    }
                    rows={1}
                    className="min-h-[44px] max-h-[300px] flex-1 resize-none border-0 bg-transparent py-3 px-3 shadow-none focus-visible:outline-none focus:ring-0 text-[13px] leading-relaxed custom-scrollbar placeholder:text-muted-foreground/50"
                  />
                  <div className="p-1 shrink-0 pb-2 pr-2">
                    <Button
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all shadow-sm", 
                        !canSend ? "bg-muted text-muted-foreground" :
                        mode === "ASK" ? "bg-blue-600 hover:bg-blue-500 text-white shadow-glow-sm hover:scale-105" :
                        mode === "PLAN" ? "bg-purple-600 hover:bg-purple-500 text-white shadow-glow-sm hover:scale-105" :
                        "bg-amber-600 hover:bg-amber-500 text-white shadow-glow-sm hover:scale-105"
                      )}
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 text-[10px] font-medium text-muted-foreground/50">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><kbd className="font-mono bg-muted/40 rounded px-1.5 py-0.5 border border-border/30 shadow-sm text-foreground/70">Ctrl+K</kbd> Command Palette</span>
              </div>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><kbd className="font-mono bg-muted/40 rounded px-1.5 py-0.5 border border-border/30 shadow-sm text-foreground/70">Shift ↵</kbd> New Line</span>
                <span className="flex items-center gap-1.5"><kbd className="font-mono bg-muted/40 rounded px-1.5 py-0.5 border border-border/30 shadow-sm text-foreground/70">↵</kbd> Send</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel: Context Panel */}
      <aside className="hidden xl:flex w-[280px] shrink-0 flex-col z-10 border-l border-border/40 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] bg-card/20">
        <ContextPanel repositoryId={repositoryId} scopePaths={scopePaths} />
      </aside>
    </div>
  );
}