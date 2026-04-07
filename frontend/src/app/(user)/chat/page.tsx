"use client";

import * as React from "react";

import { ChatMessage } from "@/components/shared/chat-message";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type Project, type Repository, toApiError } from "@/lib/api";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceCount?: number;
}

export default function ChatPage(): React.JSX.Element {
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [messages, setMessages] = React.useState<ChatEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoadingRepos, setLoadingRepos] = React.useState(false);
  const [isSending, setSending] = React.useState(false);

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
      if (merged[0]) {
        setSelectedRepositoryId((previous) => previous || merged[0].id);
      }
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRepositories();
  }, [loadRepositories]);

  const onSendMessage = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!query.trim() || !selectedRepositoryId) {
      return;
    }

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
      setError(toApiError(requestError));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Ask repository-aware questions and get contextual AI responses."
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="text-sm font-semibold text-foreground" htmlFor="repository-selector">
              Repository
            </label>
            <Input
              id="repository-selector"
              list="repositories-list"
              value={
                repositories.find((repository) => repository.id === selectedRepositoryId)?.repo_id || ""
              }
              placeholder={isLoadingRepos ? "Loading repositories..." : "Select repository"}
              onChange={(event) => {
                const match = repositories.find((repository) => repository.repo_id === event.target.value);
                if (match) {
                  setSelectedRepositoryId(match.id);
                }
              }}
            />
            <datalist id="repositories-list">
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.repo_id} />
              ))}
            </datalist>
          </div>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-4">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <ChatMessage role={message.role} content={message.content} />
                  {message.role === "assistant" && typeof message.sourceCount === "number" ? (
                    <div className="flex justify-start pl-1">
                      <Badge variant="muted">Sources: {message.sourceCount}</Badge>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Start by asking a repository question.</p>
            )}
          </div>

          <form onSubmit={onSendMessage} className="space-y-3">
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about architecture, files, logic, or code behavior..."
              className="min-h-[120px]"
              required
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedRepositoryId
                  ? "Responses are grounded on the selected repository context."
                  : "Select a repository before chatting."}
              </p>
              <Button type="submit" disabled={isSending || !selectedRepositoryId}>
                {isSending ? "Generating..." : "Send"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
