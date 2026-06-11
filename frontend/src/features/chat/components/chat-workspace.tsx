"use client";

import * as React from "react";
import { Loader2, Send, StopCircle, Database, Search, PenTool, PlayCircle, RefreshCw, GitBranch, CheckCircle2, Paperclip, Wand2, Mic } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import {
  useChat,
  useChatSessions,
  useUpdateSessionMutation,
} from "@/features/chat/hooks/use-chat";
import type { ChatMessage, ChatMode } from "@/features/chat/types/chat-types";
import { ChatMessageItemBubble } from "./chat-message-item-bubble";
import { ModeSelector } from "./mode-selector";
import { RepositoryContextHeader } from "./repository-context-header";
import { ScopeSelector } from "./scope-selector";
import { ChatSessionSidebar } from "./chat-session-sidebar";
import { ContextPanel } from "./context-panel";
import { cn } from "@/lib/utils";
import type { Repository } from "@/features/repositories/types/repository-types";
import { MultiRepositorySelect } from "./multi-repository-select";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { useWorkspaceStore } from "@/features/workspace/store/workspace-store";

interface ChatWorkspaceProps {
  repositoryId?: string;
  repositories?: Repository[];
  onRepositoryChange?: (id: string) => void;
  isRepositoriesLoading?: boolean;
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
  const [selectedRepoIds, setSelectedRepoIds] = React.useState<string[]>([]);
  const virtuosoRef = React.useRef<any>(null);
  const { setActiveSessionId } = useWorkspaceStore();

  const {
    messages,
    sendMessage,
    stopGeneration,
    isSending,
    isHistoryLoading,
    historyError,
    currentSessionId,
  } = useChat({ repositoryId });

  const sessionsQuery = useChatSessions(100, 0);
  const updateSessionMutation = useUpdateSessionMutation();
  
  const sessions = React.useMemo(() => sessionsQuery.data?.items ?? [], [sessionsQuery.data?.items]);
  const historyErrorMessage =
    historyError instanceof Error ? historyError.message : historyError ? "Unable to load history." : "";

  // Sync scopePaths when session changes
  React.useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find((s: any) => s.id === currentSessionId);
      if (session && session.metadata?.scope_paths) {
        setScopePaths(session.metadata.scope_paths);
      } else {
        setScopePaths([]);
      }
    } else {
      setScopePaths([]);
    }
  }, [currentSessionId, sessions]);

  // Persist scopePaths to session when it changes
  const handleScopeChange = React.useCallback((newPaths: string[]) => {
    setScopePaths(newPaths);
    if (currentSessionId) {
      updateSessionMutation.mutate({ 
        sessionId: currentSessionId, 
        payload: { metadata: { scope_paths: newPaths } } 
      });
    }
  }, [currentSessionId, updateSessionMutation]);

  const canSend = (Boolean(repositoryId) || selectedRepoIds.length > 0) && query.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = query.trim();
    setQuery("");
    try {
      if (selectedRepoIds.length > 0) {
        toast.info("Retrieving Federated Context", `Querying ${selectedRepoIds.length} repositories...`);
        const allResults = await Promise.allSettled(
          selectedRepoIds.map((rid) =>
            repositoryService.retrieveRepository(rid, { query: trimmed, top_k: 6 })
          )
        );

        let formattedContext = "Below is the retrieved cross-repository context for this query:\n\n";
        let idx = 0;
        allResults.forEach((result) => {
          if (result.status === "fulfilled") {
            result.value.items?.forEach((item) => {
              idx++;
              const displayScore = item.rerank_score !== undefined ? item.rerank_score : item.score;
              formattedContext += `[Source #${idx}] File: ${item.path} (Repository: ${item.repository_id})\n`;
              formattedContext += `Symbol: ${item.symbol || "unknown"}\n`;
              formattedContext += `Score: ${(displayScore * 100).toFixed(1)}%\n`;
              formattedContext += "```\n" + item.content + "\n```\n\n";
            });
          }
        });
        if (idx === 0) {
          formattedContext += "(No matching snippets retrieved across repositories)\n\n";
        }

        const finalQuery = `${formattedContext}\nUser Query: ${trimmed}`;
        await sendMessage(finalQuery, mode, scopePaths);
      } else {
        await sendMessage(trimmed, mode, scopePaths);
      }
    } catch (error) {
      if ((error as any).name !== "AbortError") {
         const message = error instanceof Error ? error.message : "Unable to send message.";
         toast.error("Chat Failed", message);
      }
    }
  };


  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0B0D14]">

      {/* Left Sidebar */}
      <ChatSessionSidebar 
        sessions={sessions} 
        isLoading={sessionsQuery.isLoading} 
        currentSessionId={currentSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onDeleteSession={(id) => { /* logic */ }}
        onNewSession={() => setActiveSessionId(null)}
        repositoryId={repositoryId}
        repositories={repositories}
      />

      {/* Center: Main Canvas */}
      <main className="flex min-h-0 flex-1 flex-col bg-[#0B0D14] relative z-0">
        <RepositoryContextHeader 
          repositoryId={repositoryId} 
          mode={mode} 
          scopePaths={scopePaths} 
          sessionTitle={sessions.find((s: any) => s.id === currentSessionId)?.session_title || sessions.find((s: any) => s.id === currentSessionId)?.summary || undefined}
        />
        
        <div className="min-h-0 flex-1 relative">
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

          {messages.length === 0 && !isHistoryLoading && (
            <div className="absolute inset-0 flex justify-center overflow-y-auto custom-scrollbar p-6 md:p-8">
              <div className="flex flex-col max-w-4xl w-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 mt-10">
                
                {/* Initial Screen Content */}
                <div className="flex flex-col items-center justify-center text-center mt-20">
                  <div className="w-16 h-16 rounded-2xl bg-[#1A1C23] border border-[#2D313E] flex items-center justify-center mb-6 shadow-lg">
                    <Database className="w-8 h-8 text-[#58A6FF]" />
                  </div>
                  <h2 className="text-2xl font-semibold text-[#E2E8F0] tracking-tight mb-2">How can I help you build today?</h2>
                  <p className="text-[#8B949E] text-[15px] max-w-md">Describe your task, ask a question, or select a mode to get started.</p>
                </div>

              </div>
            </div>
          )}

          <div className="absolute inset-0 pt-2 pb-40">
             <Virtuoso
                ref={virtuosoRef}
                data={messages}
                itemContent={(_, message) => <ChatMessageItemBubble key={message.id} message={message} mode={mode} />}
                className="h-full w-full custom-scrollbar px-2 md:px-6"
                alignToBottom
                followOutput="smooth"
             />
             {messages.length > 0 && (
               <div className="text-center mt-4 mb-32 flex justify-center">
                 <span className="text-[11px] font-medium text-[#3FB950] bg-[#238636]/10 border border-[#238636]/30 px-3 py-1 rounded-full">
                   Index Status: Synchronized & Healthy
                 </span>
               </div>
             )}
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 pt-12 pb-6 z-20 pointer-events-none px-4 md:px-12 bg-gradient-to-t from-[#0B0D14] via-[#0B0D14]/90 to-transparent">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 relative pointer-events-auto">
            
            {/* Status indicators */}
            <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
              {isSending && (
                <Button 
                   size="sm" 
                   variant="outline" 
                   onClick={stopGeneration}
                   className="h-8 rounded-full border-[#2D313E] bg-[#1A1C23] text-xs font-semibold shadow-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-[#C9D1D9] transition-all"
                >
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                  Stop generating
                </Button>
              )}
            </div>

            <div className={cn(
              "relative flex flex-col gap-0 rounded-xl border bg-[#161822] shadow-2xl transition-all overflow-hidden group mx-auto w-full",
              "border-[#2D313E] focus-within:border-[#3B82F6]/50 focus-within:ring-2 focus-within:ring-[#3B82F6]/10"
            )}>
              <div className="flex flex-col gap-2 p-2 pt-3">
                
                {/* Top Action Bar (Mode selector, Repo, Branch, Scope) */}
                <div className="flex items-center gap-2 px-2 pb-2">
                  <ModeSelector mode={mode} onModeChange={setMode} />
                  
                  <div className="flex items-center gap-2 ml-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#C9D1D9] bg-[#1A1C23] px-2 py-1 rounded-md border border-[#2D313E]">
                      <Database className="w-3 h-3 text-[#8B949E]" /> {repositories?.find(r => r.id === repositoryId)?.repo_id?.split('/').pop() || "No repo"}
                    </div>
                    
                    <MultiRepositorySelect 
                      repositories={repositories} 
                      selectedIds={selectedRepoIds} 
                      onChange={setSelectedRepoIds} 
                    />

                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#C9D1D9] bg-[#1A1C23] px-2 py-1 rounded-md border border-[#2D313E]">
                      <GitBranch className="w-3 h-3 text-[#8B949E]" /> main
                    </div>
                    
                    <ScopeSelector scopePaths={scopePaths} onChange={setScopePaths} />
                  </div>
                </div>

                <div className="flex items-end gap-2 pt-1 pb-1 px-1 relative">
                  <div className="absolute left-3 top-2 flex items-center justify-center text-[#8B949E]">
                    <div className="w-5 h-5 rounded bg-[#1A1C23] border border-[#2D313E] flex items-center justify-center text-[10px] font-bold text-[#58A6FF]">
                      Ask
                    </div>
                  </div>
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
                    placeholder="Describe the changes, ask a question, or reference files..."
                    rows={1}
                    className="min-h-[44px] max-h-[300px] flex-1 resize-none border-0 bg-transparent py-2.5 pl-11 pr-3 shadow-none focus-visible:outline-none focus:ring-0 text-[14px] leading-relaxed custom-scrollbar text-[#E2E8F0] placeholder:text-[#8B949E]"
                  />
                </div>

                <div className="flex items-center justify-between px-2 pb-1 mt-1 border-t border-[#2D313E]/50 pt-2">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]">
                      <Wand2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]">
                      <Mic className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-[#8B949E] hidden sm:flex">
                      <kbd className="font-sans font-semibold bg-[#1A1C23] rounded px-1.5 py-0.5 border border-[#2D313E]">↵</kbd> Send
                    </div>
                    <Button
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      size="sm"
                      className="h-8 px-5 rounded-md bg-[#5CD4C2] hover:bg-[#4bc2b0] text-black font-bold tracking-wide transition-colors border-none"
                    >
                      Ask
                    </Button>
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <ContextPanel repositoryId={repositoryId} />

    </div>
  );
}