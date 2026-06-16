export type ChatMode = "ASK" | "PLAN" | "ACT";

export type ChatSession = {
  id: string;
  repository_id: string | null;
  session_title: string | null;
  session_mode: string;
  is_pinned: boolean;
  is_archived: boolean;
  summary: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  metadata?: Record<string, any>;
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
  scope_paths?: string[];
};

export type Source = {
  id?: string;
  path: string;
  symbol?: string;
  content: string;
  start_line?: number;
  end_line?: number;
  rerank_score?: number;
  score?: number;
  repository_id?: string;
  repo_id?: string;
  kind?: string;
  proposal?: any;
};

export type ChatResponsePayload = {
  answer: string;
  intent: string;
  session_id: string;
  sources: Source[];
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
  sources: Source[];
  proposal?: unknown;
  trace?: unknown;
  usage?: TokenUsage;
  session_usage?: SessionUsageTotals;
};

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  source?: string;
  model?: string;
};

export type SessionUsageTotals = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  request_count?: number;
};

export type ChatStreamStatus = { type: "status"; step: string; stage?: string };
export type ChatStreamSource = { type: "source"; source: Source };
export type ChatStreamProgress = { type: "progress"; stage: string; percent: number };
export type ChatStreamError = { type: "error"; error: string };
export type ChatStreamAnswer = { type: "answer"; text: string };
export type ChatStreamPatch = { type: "patch"; diff: string };

export type ChatStreamEvent = 
  | ChatStreamStart 
  | ChatStreamChunk 
  | ChatStreamDone
  | ChatStreamStatus
  | ChatStreamSource
  | ChatStreamProgress
  | ChatStreamError
  | ChatStreamAnswer
  | ChatStreamPatch;
