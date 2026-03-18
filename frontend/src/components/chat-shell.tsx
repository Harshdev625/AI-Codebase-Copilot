"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Bot, User, FileCode, Zap, AlertCircle, Plus, Copy, Check, Building, Bug, RefreshCw, BookOpen } from "lucide-react";
import Link from "next/link";
import { sendChat } from "@/lib/api";

type Source   = { path?: string; symbol?: string };
type Repo = { id: string; repo_id: string };
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

export function ChatShell() {
  const [repoId,   setRepoId]   = useState("");
  const [repos,    setRepos]    = useState<Repo[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const projectId = localStorage.getItem("aicc_project_id") || "";
    const token = localStorage.getItem("aicc_token") || "";
    if (!projectId) {
      setSetupError("Select or create a project first from the repositories page.");
      return;
    }

    fetch(`/api/projects/${projectId}/repositories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          setSetupError("Add and index at least one repository before using chat.");
          return;
        }
        setRepos(data);
        setRepoId(data[0].repo_id);
        setSetupError(null);
      })
      .catch(() => setSetupError("Failed to load repositories for chat."));
  }, []);

  async function submit(query: string) {
    if (!query.trim() || loading || !repoId) return;
    const userMsg: Message = { role: "user", content: query.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const data = await sendChat({ repo_id: repoId, query: query.trim() }) as {
        answer: string; intent: string; sources: Source[];
      };
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.answer,
        intent:  data.intent,
        sources: data.sources,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: err instanceof Error ? err.message : "Unexpected error occurred.",
        error:   true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(input);
  }

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface to-background shadow-2xl" style={{ height: "calc(100vh - 8rem)" }}>
      {/* ── Modern Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-blue-600/10 to-purple-600/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-text text-lg">AI Code Assistant</p>
            <p className="text-xs text-muted">Semantic search · Agentic RAG · Real-time answers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted">Repository:</label>
          <select
            className="rounded-lg border border-border/50 bg-surface2 hover:bg-surface2 px-3.5 py-2 text-sm text-text focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
          >
            <option value="">Select repo</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.repo_id}>{repo.repo_id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Chat Messages ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-8 text-center py-12">
            <div className="space-y-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/30">
                <Zap className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text">Ask about your code</p>
                <p className="mt-2 text-sm text-muted max-w-md mx-auto">Ask questions about architecture, debugging, refactoring, and more</p>
              </div>
              {setupError && (
                <div className="mt-4 flex flex-col items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-2 text-orange-700 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {setupError}
                  </div>
                  <Link
                    href="/repositories"
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-semibold transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Go to Repositories
                  </Link>
                </div>
              )}
            </div>
            
            {/* Suggestion Grid */}
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
              {SUGGESTIONS.map((s, i) => {
                const IconComponent = s.icon;
                return (
                  <button
                    key={i}
                    onClick={() => submit(s.text)}
                    className="group p-4 rounded-xl border border-border/50 bg-surface2/50 hover:bg-gradient-to-br hover:from-blue-500/10 hover:to-purple-500/10 hover:border-blue-500/30 transition-all text-left"
                  >
                    <IconComponent className="h-6 w-6 mb-2 text-blue-600 group-hover:text-purple-600 transition-colors" />
                    <p className="text-sm font-medium text-text group-hover:text-blue-600 transition-colors">{s.text}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}>
            {/* Avatar */}
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 flex-none ${
              msg.role === "user"
                ? "bg-gradient-to-br from-blue-500 to-blue-600 ring-blue-500/30"
                : msg.error
                  ? "bg-gradient-to-br from-red-500 to-red-600 ring-red-500/30"
                  : "bg-gradient-to-br from-purple-500 to-purple-600 ring-purple-500/30"
            }`}>
              {msg.role === "user"
                ? <User className="h-4 w-4 text-white" />
                : msg.error
                  ? <AlertCircle className="h-4 w-4 text-white" />
                  : <Bot className="h-4 w-4 text-white" />
              }
            </div>

            {/* Content */}
            <div className={`max-w-2xl space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.intent && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold w-fit">
                  <Zap className="h-3 w-3" />
                  {msg.intent}
                </div>
              )}
              
              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white shadow-md"
                  : msg.error
                    ? "bg-red-50 text-red-900 border border-red-200"
                    : "bg-surface2 border border-border/50 text-text shadow-sm"
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-normal">{msg.content}</div>
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-surface2/50 px-4 py-3 mt-2">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                    <FileCode className="h-3.5 w-3.5" />
                    Sources ({msg.sources.length})
                  </p>
                  <div className="space-y-1.5">
                    {msg.sources.map((src, i) => (
                      <div key={i} className="p-2 rounded-lg bg-background/50 hover:bg-background transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-blue-600 font-mono">
                            {src.path ?? "unknown"}
                            {src.symbol && <span className="text-muted"> · {src.symbol}</span>}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${src.path}${src.symbol ? ` · ${src.symbol}` : ""}`, idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-border rounded"
                            title="Copy"
                          >
                            {copied === idx ? (
                              <Check className="h-3 w-3 text-green-600" />
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
                  className="text-xs text-muted hover:text-text transition-colors flex items-center gap-1.5"
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

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-4 animate-fade-in">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex-none">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center rounded-2xl bg-surface2 border border-border/50 px-4 py-3 gap-2">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0s" }} />
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
              <span className="text-xs text-muted">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar ───────────────────────────────────────────── */}
      <div className="border-t border-border/50 bg-gradient-to-t from-background to-surface/50 p-5">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            className="flex-1 rounded-xl border border-border/50 bg-surface2 px-4 py-3 text-sm text-text placeholder-muted focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="Ask anything about your code…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !repoId}
            className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
            title="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
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
