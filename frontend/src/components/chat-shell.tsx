"use client";

import * as React from "react";

import { sendChat } from "@/lib/api";

type RepositoryItem = {
  id: string;
  repo_id: string;
};

type ChatResult = {
  answer: string;
  intent?: string;
  sources?: Array<{ path?: string; symbol?: string }>;
};

export function ChatShell(): React.JSX.Element {
  const [repositories, setRepositories] = React.useState<RepositoryItem[]>([]);
  const [selectedRepo, setSelectedRepo] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<ChatResult | null>(null);

  React.useEffect(() => {
    const token = window.localStorage.getItem("aicc_token") || "";
    const projectId = window.localStorage.getItem("aicc_project_id") || "";

    void fetch(`/api/projects/${projectId}/repositories`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load repositories");
        }
        const payload = (await response.json()) as RepositoryItem[];
        setRepositories(payload);
        if (payload.length > 0) {
          setSelectedRepo(payload[0].repo_id);
        }
      })
      .catch(() => {
        setRepositories([]);
      });
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSubmitting || !selectedRepo) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = (await sendChat({ repo_id: selectedRepo, query: trimmed })) as ChatResult;
      setResult(response);
      setQuery("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>AI Code Assistant</h1>

      {repositories.length === 0 ? (
        <p>Add and index at least one repository before starting chat.</p>
      ) : (
        <label>
          Repository
          <select value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)}>
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.repo_id}>
                {repository.repo_id}
              </option>
            ))}
          </select>
        </label>
      )}

      <form onSubmit={onSubmit}>
        <input
          placeholder="Ask anything about your code…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={isSubmitting}
        />
      </form>

      {error ? <p>{error}</p> : null}

      {result ? (
        <article>
          <p>{result.answer}</p>
          {result.intent ? <span>{result.intent}</span> : null}
          {Array.isArray(result.sources)
            ? result.sources.map((source, index) => (
                <div key={`${source.path || "source"}-${index}`}>
                  <span>{source.path}</span>
                  {source.symbol ? <span>{source.symbol}</span> : null}
                </div>
              ))
            : null}
        </article>
      ) : null}
    </section>
  );
}
