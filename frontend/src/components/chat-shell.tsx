"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Bot, User, FileCode, Zap, AlertCircle, Plus, Copy, Check, Building, Bug, RefreshCw, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendChat, streamChat } from "@/lib/api";
import { apiRequest } from "@/lib/http";

type Source   = { path?: string; symbol?: string };
type CopilotMode = "architecture" | "debug" | "refactor" | "docs" | "codegen";
type Repo = {
  id: string;
  repo_id: string;
  latest_index_status?: string | null;
  has_completed_index?: boolean;
};
type Message  = {
  role:    "user" | "assistant";
  content: string;
  intent?: string;
  sources?: Source[];
  error?:  boolean;
};

const SUGGESTIONS = [
  { icon: Building, text: "Explain the architecture" },
  { icon: Bug, text: "Help me debug this" },
  { icon: RefreshCw, text: "How to refactor this?" },
  { icon: BookOpen, text: "Generate documentation" },
];

const MODE_LABELS: Record<CopilotMode, string> = {
  architecture: "Architecture",
  debug: "Debug",
  refactor: "Refactor",
  docs: "Docs",
  codegen: "Code",
};

const MODE_PROMPT_PREFIX: Record<CopilotMode, string> = {
  architecture: "Explain architecture with modules, dependencies, and data flow. Include key files and why they matter.",
  debug: "Act as debugging copilot. Identify likely root causes, exact files/lines to inspect, and a minimal fix plan.",
  refactor: "Act as refactor copilot. Suggest safe incremental refactor steps with risks and migration notes.",
  docs: "Act as documentation copilot. Produce concise developer documentation and onboarding notes from the code.",
  codegen: "Act as coding copilot. Provide implementation-ready code changes and mention where each change belongs.",
};

export function ChatShell() {
  const [repoId,   setRepoId]   = useState("");
  const [repos,    setRepos]    = useState<Repo[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [mode, setMode] = useState<CopilotMode>("architecture");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const projectId = localStorage.getItem("aicc_project_id") || "";
    if (!projectId) {
      setSetupError("Select or create a project first from the repositories page.");
      return;
    }

    apiRequest<Repo[]>(`/api/projects/${projectId}/repositories`)
      .then((result) => {
        if (!result.success || !result.data || !Array.isArray(result.data)) {
          setSetupError(result.error || "Failed to load repositories for chat.");
          return;
        }

        const data = result.data;
        if (data.length === 0) {
          setSetupError("Add and index at least one repository before using chat.");
          return;
        }

        const indexedRepos = data.filter((repo: Repo) => repo.has_completed_index || repo.latest_index_status === "completed");
        setRepos(data);

        if (indexedRepos.length > 0) {
          setRepoId(indexedRepos[0].repo_id);
          setSetupError(null);
          return;
        }

        setRepoId(data[0].repo_id);
        setSetupError("No repository is indexed yet. Go to Repositories and run Index first.");
      })
      .catch(() => setSetupError("Failed to load repositories for chat."));
  }, []);

  async function submit(query: string) {
    if (!query.trim() || loading || !repoId) return;
    const trimmedQuery = query.trim();
    const userMsg: Message = { role: "user", content: trimmedQuery };
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const modePrefix = MODE_PROMPT_PREFIX[mode];
      const enrichedQuery = mode === "architecture"
        ? trimmedQuery
        : `${modePrefix}\n\nUser request: ${trimmedQuery}`;

      if (typeof streamChat === "function") {
        await streamChat(
          { repo_id: repoId, query: enrichedQuery },
          {
            onStart: (event) => {
              setMessages((prev) =>
                prev.map((msg, idx) =>
                  idx === assistantIndex
                    ? {
                        ...msg,
                        intent: event.intent,
                      }
                    : msg
                )
              );
            },
            onChunk: (delta) => {
              setMessages((prev) =>
                prev.map((msg, idx) =>
                  idx === assistantIndex
                    ? {
                        ...msg,
                        content: `${msg.content}${delta}`,
                      }
                    : msg
                )
              );
            },
            onDone: (event) => {
              setMessages((prev) =>
                prev.map((msg, idx) =>
                  idx === assistantIndex
                    ? {
                        ...msg,
                        intent: event.intent ?? msg.intent,
                        sources: event.sources,
                      }
                    : msg
                )
              );
            },
          }
        );
      } else {
        const data = await sendChat({ repo_id: repoId, query: enrichedQuery }) as {
          answer: string; intent: string; sources: Source[];
        };
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === assistantIndex
              ? {
                  role: "assistant",
                  content: data.answer,
                  intent: data.intent,
                  sources: data.sources,
                }
              : msg
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === assistantIndex
            ? {
                role: "assistant",
                content: err instanceof Error ? err.message : "Unexpected error occurred.",
                error: true,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(input);
  }

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl md:h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-r from-primary/15 via-surface to-accent/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-text">AI Code Assistant</p>
            <p className="text-xs text-muted">Semantic search · Agentic RAG · Real-time answers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted">Repository:</label>
          <select className="input-base h-9 w-[220px] py-1.5" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
            <option value="">Select repo</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.repo_id}>{repo.repo_id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface2/40 px-4 py-3 sm:px-6">
        <span className="text-xs text-muted">Mode:</span>
        {(Object.keys(MODE_LABELS) as CopilotMode[]).map((modeKey) => (
          <Button
            key={modeKey}
            type="button"
            onClick={() => setMode(modeKey)}
            variant={mode === modeKey ? "primary" : "secondary"}
            size="sm"
            className="rounded-full px-3 py-1 text-xs"
          >
            {MODE_LABELS[modeKey]}
          </Button>
        ))}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 scroll-smooth sm:px-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-8 py-12 text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-dim ring-1 ring-primary/30">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text">Ask about your code</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">Ask questions about architecture, debugging, refactoring, and more</p>
              </div>
              {setupError && (
                <Card className="mt-4 flex flex-col items-center gap-3 border-warning/30 bg-warning-dim p-4 text-warning">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {setupError}
                  </div>
                  <Link href="/repositories">
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Go to Repositories
                    </Button>
                  </Link>
                </Card>
              )}
            </div>

            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => {
                const IconComponent = s.icon;
                return (
                  <button
                    key={i}
                    onClick={() => submit(s.text)}
                    className="group text-left"
                  >
                    <Card className="border border-border/60 bg-surface2/50 p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
                      <IconComponent className="mb-2 h-6 w-6 text-primary transition-colors group-hover:text-accent" />
                      <p className="text-sm font-medium text-text">{s.text}</p>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 flex-none ${
              msg.role === "user"
                ? "bg-primary ring-primary/30"
                : msg.error
                  ? "bg-danger ring-danger/30"
                    : "bg-gradient-to-br from-primary to-accent ring-primary/30"
            }`}>
              {msg.role === "user"
                ? <User className="h-4 w-4 text-white" />
                : msg.error
                  ? <AlertCircle className="h-4 w-4 text-white" />
                  : <Bot className="h-4 w-4 text-white" />
              }
            </div>

            <div className={`max-w-2xl space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.intent && (
                <div className="flex w-fit items-center gap-2 rounded-full bg-primary-dim px-3 py-1 text-xs font-semibold text-primary">
                  <Zap className="h-3 w-3" />
                  {msg.intent}
                </div>
              )}

              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-white shadow-md"
                  : msg.error
                    ? "border border-danger/30 bg-danger-dim text-danger"
                    : "bg-surface2 border border-border/50 text-text shadow-sm"
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-normal">{msg.content}</div>
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 rounded-xl border border-border/50 bg-surface2/50 px-4 py-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                    <FileCode className="h-3.5 w-3.5" />
                    Sources ({msg.sources.length})
                  </p>
                  <div className="space-y-1.5">
                    {msg.sources.map((src, i) => (
                      <div key={i} className="group rounded-lg bg-background/50 p-2 transition-colors hover:bg-background">
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs text-primary">
                            {src.path ?? "unknown"}
                            {src.symbol && <span className="text-muted"> · {src.symbol}</span>}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${src.path}${src.symbol ? ` · ${src.symbol}` : ""}`, idx)}
                            className="rounded p-1 opacity-0 transition-opacity hover:bg-border group-hover:opacity-100"
                            title="Copy"
                          >
                            {copied === idx ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {msg.role === "assistant" && !msg.error && (
                <button
                  onClick={() => copyToClipboard(msg.content, idx)}
                  className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
                  title="Copy response"
                >
                  {copied === idx ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4 animate-fade-in">
            <div className="flex h-9 w-9 shrink-0 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-surface2 px-4 py-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0s" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0.4s" }} />
              </div>
              <span className="text-xs text-muted">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-gradient-to-t from-background to-surface/70 p-4 sm:p-5">
        <form onSubmit={onSubmit} className="flex gap-3">
          <Input
            className="flex-1"
            placeholder="Ask anything about your code…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !input.trim() || !repoId}
            className="h-11 w-11 shrink-0 p-0"
            title="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-subtle">
            {!repoId && !setupError
              ? "Select a repository above to start chatting."
              : setupError
                ? "Index a repository first before chatting."
                : "Results powered by local RAG + semantic search"}
          </p>
        </div>
      </div>
    </div>
  );
}
