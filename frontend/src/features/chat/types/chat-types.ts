export type ChatMode = "question" | "refactor" | "debug" | "documentation" | "tool";

export type ChatSession = {
  id: string;
  repository_id: string | null;
  title: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatRequestPayload = {
  repository_id?: string;
  repo_id?: string;
  query: string;
  session_id?: string;
  mode?: ChatMode;
  include_patch?: boolean;
};

export type ChatResponsePayload = {
  answer: string;
  intent: string;
  session_id: string;
  sources: Array<Record<string, unknown>>;
};

export type ChatStreamStart = {
  type: "start";
  intent: string;
  session_id?: string | null;
};

export type ChatStreamChunk = {
  type: "chunk";
  delta: string;
};

export type ChatStreamDone = {
  type: "done";
  intent: string;
  sources: Array<Record<string, unknown>>;
  proposal?: unknown;
  trace?: unknown;
};

export type ChatStreamEvent = ChatStreamStart | ChatStreamChunk | ChatStreamDone;
