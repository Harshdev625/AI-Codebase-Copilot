"use client";

import * as React from "react";
import { Bot, LoaderCircle, Send, UserRound, Layout, Database, Sparkles } from "lucide-react";

import { ChatMessage } from "@/components/shared/chat-message";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/shared/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type Project, type Repository, toApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceCount?: number;
}

export default function ChatPage(): React.JSX.Element {
  const toast = useToast();
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [messages, setMessages] = React.useState<ChatEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoadingRepos, setLoadingRepos] = React.useState(false);
  const [isSending, setSending] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const loadRepositories = React.useCallback(async (): Promise<void> => {
    setLoadingRepos(true);
    setError(null);

    try {
      const projects: Project[] = await api.projects.list();
      const nestedRepositories = await Promise.all(
        projects.map((project) => api.repositories.listByProject(project.id))
      );
      const merged = nestedRepositories.flat();
      setRepositories(merged);
      if (merged[0] && !selectedRepositoryId) {
        setSelectedRepositoryId(merged[0].id);
      }
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Failed to load repositories", message);
    } finally {
      setLoadingRepos(false);
    }
  }, [toast, selectedRepositoryId]);

  React.useEffect(() => {
    void loadRepositories();
  }, [loadRepositories]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const onSendMessage = async (event?: React.FormEvent): Promise<void> => {
    event?.preventDefault();
    if (!query.trim() || !selectedRepositoryId || isSending) return;

    const prompt = query.trim();
    setQuery("");
    setError(null);
    setSending(true);

    const userMessage: ChatEntry = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    setMessages((previous) => [...previous, userMessage]);

    try {
      const response = await api.chat.ask({
        repository_id: selectedRepositoryId,
        query: prompt,
      });
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          sourceCount: response.sources?.length ?? 0,
        },
      ]);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Chat request failed", message);
    } finally {
      setSending(false);
    }
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepositoryId);

  return (
    <div className="mx-auto flex flex-1 min-h-0 w-full max-w-5xl flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <PageHeader
          title="AI Workspace"
          description="Context-aware codebase assistant powered by agentic RAG."
        />
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-7 border-primary/20 bg-primary/5 px-3 text-primary">
                <Sparkles className="mr-1.5 h-3 w-3" />
                GPT-4 Turbo
            </Badge>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_300px] gap-6">
        {/* Main Chat Area */}
        <Card className="flex flex-col overflow-hidden border-border/50 bg-background/50 shadow-md">
          <CardContent className="flex flex-1 flex-col p-0">
            {/* Messages Container */}
            <div 
              ref={containerRef}
              className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin"
            >
              {isLoadingRepos ? (
                <div className="space-y-6">
                  <div className="flex gap-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-20 w-3/4" /></div>
                  <div className="flex justify-end gap-3"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-12 w-12 rounded-full" /></div>
                </div>
              ) : messages.length > 0 ? (
                messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    <div className={cn("flex items-center gap-2", message.role === "user" ? "flex-row-reverse" : "")}>
                       <div className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", 
                            message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border")}>
                          {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                       </div>
                       <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          {message.role}
                       </span>
                    </div>
                    <ChatMessage role={message.role} content={message.content} />
                    {message.role === "assistant" && typeof message.sourceCount === "number" && (
                      <div className="flex justify-start pl-8">
                        <Badge variant="secondary" className="text-[10px] py-0 h-5 bg-muted/50 hover:bg-muted font-normal text-muted-foreground border-none">
                          {message.sourceCount} sources used
                        </Badge>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Your AI Workspace"
                  description="Ask anything about this codebase. I can explain architecture, find bugs, or help you refactor components."
                  className="h-full border-none bg-transparent"
                />
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-border bg-background/80 p-4 backdrop-blur-sm">
              <form 
                onSubmit={(e) => { e.preventDefault(); onSendMessage(); }}
                className="relative flex flex-col gap-2"
              >
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSendMessage();
                    }
                  }}
                  placeholder={selectedRepositoryId ? "Ask a question..." : "Select a repository to start..."}
                  className="min-h-[100px] w-full resize-none border-border/50 bg-muted/20 px-4 py-3 text-sm focus-visible:ring-primary/20"
                  disabled={!selectedRepositoryId || isSending}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">Enter</kbd>
                    <span>to send</span>
                    <span className="mx-1">·</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">Shift + Enter</kbd>
                    <span>for new line</span>
                  </div>
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isSending || !query.trim() || !selectedRepositoryId}
                    className="h-8 shadow-sm transition-ui"
                  >
                    {isSending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Context */}
        <div className="hidden lg:flex flex-col gap-6">
          <Card className="border-border/50 bg-background/50 shadow-sm">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Context</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Repository</label>
                <select 
                   value={selectedRepositoryId}
                   onChange={(e) => setSelectedRepositoryId(e.target.value)}
                   className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                   disabled={isLoadingRepos}
                >
                  {repositories.length === 0 && <option value="">No Repos</option>}
                  {repositories.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.repo_id}</option>
                  ))}
                </select>
              </div>

              {selectedRepo && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Branch</span>
                        <span className="font-mono text-foreground">{selectedRepo.default_branch}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className="h-4 border-none bg-green-500/10 text-green-500 text-[9px] font-bold">READY</Badge>
                    </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-border/50 bg-background/50 shadow-sm flex-1">
             <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <Layout className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Shortcuts</span>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Explain this code</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">/</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Find security risks</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">!</kbd>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Refactor function</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">@</kbd>
                </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
