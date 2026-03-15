"use client";

import { FormEvent, useState } from "react";
import { sendChat } from "@/lib/api";

type Source = {
  path?: string;
  symbol?: string;
};

type ChatResponse = {
  answer: string;
  intent: string;
  sources: Source[];
};

export function ChatShell() {
  const [repoId, setRepoId] = useState("demo-repo");
  const [query, setQuery] = useState("Where is authentication implemented?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = (await sendChat({ repo_id: repoId, query })) as ChatResponse;
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-8 rounded-xl bg-panel p-6 shadow-lg">
        <h1 className="text-3xl font-semibold">AI Codebase Copilot</h1>
        <p className="mt-2 text-sm text-muted">
          Agentic RAG assistant for code search, debugging, refactoring, and documentation.
        </p>
      </header>

      <section className="rounded-xl bg-panel p-6 shadow-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">Repository ID</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Query</label>
            <textarea
              className="h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 font-medium text-slate-900 disabled:opacity-70"
          >
            {loading ? "Thinking..." : "Ask Copilot"}
          </button>
        </form>
      </section>

      {error ? (
        <section className="mt-6 rounded-xl border border-rose-400/50 bg-rose-900/20 p-4 text-rose-200">
          {error}
        </section>
      ) : null}

      {response ? (
        <section className="mt-6 rounded-xl bg-panel p-6 shadow-lg">
          <div className="mb-4 text-xs uppercase tracking-wide text-primary">
            Intent: {response.intent}
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-6">{response.answer}</pre>

          {response.sources?.length ? (
            <div className="mt-6 border-t border-slate-700 pt-4">
              <h2 className="mb-2 text-sm font-medium">Sources</h2>
              <ul className="space-y-2 text-sm text-muted">
                {response.sources.map((source, idx) => (
                  <li key={`${source.path}-${idx}`}>
                    {source.path ?? "unknown"} {source.symbol ? `• ${source.symbol}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
