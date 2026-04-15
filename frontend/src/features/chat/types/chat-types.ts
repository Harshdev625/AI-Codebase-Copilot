export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  metadata?: {
    intent?: string;
    sources?: Array<Record<string, unknown>>;
    proposal?: {
      title?: string;
      summary?: string;
      diff?: string;
      files?: string[];
      intent?: string;
    };
  };
}

export interface AskPayload {
  repository_id?: string;
  repo_id?: string;
  project_id?: string;
  query: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  session_id: string;
  sources: Array<Record<string, unknown>>;
}
