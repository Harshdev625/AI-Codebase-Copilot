"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Bot, User, FileCode, Zap, AlertCircle } from "lucide-react";
import { sendChat } from "@/lib/api";

type Source   = { path?: string; symbol?: string };
type Message  = {
  role:    "user" | "assistant";
  content: string;
  intent?: string;
  sources?: Source[];
  error?:  boolean;
};

const SUGGESTIONS = [
  "Where is authentication implemented?",
  "Explain the indexing pipeline flow.",
  "How does the RAG retrieval work?",
  "List all API endpoints available.",
];

export function ChatShell() {
  const [repoId,   setRepoId]   = useState("demo-repo");
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit(query: string) {
    if (!query.trim() || loading) return;
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

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card" style={{ height: "calc(100vh - 8rem)" }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-dim ring-1 ring-primary/30">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">Copilot Chat</p>
            <p className="text-xs text-subtle">Agentic RAG · Semantic Search</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Repo ID:</label>
          <input
            className="w-36 rounded-lg border border-border bg-surface2 px-2.5 py-1 text-xs text-text focus:border-primary/50 focus:outline-none"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            placeholder="repo-id"
          />
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-dim ring-1 ring-primary/30">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-text">Ask anything about your codebase</p>
              <p className="mt-1 text-sm text-muted">Architecture, debugging, refactoring, or documentation — I can help.</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-border bg-surface2 px-3 py-2 text-left text-xs text-muted transition-colors hover:border-primary/30 hover:bg-primary-dim hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${
              msg.role === "user"
                ? "bg-accent-dim ring-accent/30"
                : msg.error
                  ? "bg-danger-dim ring-danger/30"
                  : "bg-primary-dim ring-primary/30"
            }`}>
              {msg.role === "user"
                ? <User className="h-4 w-4 text-accent" />
                : msg.error
                  ? <AlertCircle className="h-4 w-4 text-danger" />
                  : <Bot className="h-4 w-4 text-primary" />
              }
            </div>

            {/* Bubble */}
            <div className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}>
              {msg.intent && (
                <span className="badge badge-cyan mb-1">
                  <Zap className="h-2.5 w-2.5" /> {msg.intent}
                </span>
              )}
              <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent/10 text-text ring-1 ring-accent/20"
                  : msg.error
                    ? "bg-danger-dim text-danger ring-1 ring-danger/20"
                    : "bg-surface2 text-text ring-1 ring-border"
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <FileCode className="h-3 w-3" /> Sources
                  </p>
                  <ul className="space-y-1">
                    {msg.sources.map((src, i) => (
                      <li key={i} className="truncate text-xs text-subtle">
                        <span className="text-primary">{src.path ?? "unknown"}</span>
                        {src.symbol && <span className="text-muted"> · {src.symbol}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-dim ring-1 ring-primary/30">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center rounded-xl bg-surface2 px-4 py-3 ring-1 ring-border">
              <span className="animate-typing">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div className="border-t border-border p-4">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            className="input-base flex-1"
            placeholder="Ask about your codebase…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary shrink-0 px-3"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-xs text-subtle">
          Press Enter to send · Results powered by Ollama + Qdrant RAG
        </p>
      </div>
    </div>
  );
}
