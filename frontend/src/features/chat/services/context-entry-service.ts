import { apiClient } from "@/core/api/client";

export interface ContextEntry {
  id: number;
  session_id: string;
  repository_id: string;
  path: string;
  entry_type: "FILE" | "CHUNK";
  token_count: number;
  is_pinned: boolean;
  priority: number;
  expires_at: string | null;
  created_at: string;
}

export interface ContextEntryCreatePayload {
  repository_id: string;
  path: string;
  entry_type: "FILE" | "CHUNK";
  token_count: number;
  is_pinned?: boolean;
  priority?: number;
  expires_at?: string | null;
}

export const contextEntryService = {
  list(sessionId: string): Promise<{ entries: ContextEntry[] }> {
    return apiClient(`/v1/sessions/${sessionId}/context`, { method: "GET" });
  },

  add(sessionId: string, payload: ContextEntryCreatePayload): Promise<ContextEntry> {
    return apiClient(`/v1/sessions/${sessionId}/context`, { method: "POST", body: payload });
  },

  remove(sessionId: string, entryId: number): Promise<{ deleted: boolean }> {
    return apiClient(`/v1/sessions/${sessionId}/context/${entryId}`, { method: "DELETE" });
  },
};
