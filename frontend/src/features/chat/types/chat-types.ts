export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  metadata?: {
    intent?: string;
    sources?: any[];
  };
}

export interface AskPayload {
  repository_id?: string;
  repo_id?: string;
  query: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  session_id: string;
  sources: Array<Record<string, unknown>>;
}
