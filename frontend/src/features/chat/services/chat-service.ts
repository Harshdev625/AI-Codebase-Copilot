import { apiClient } from "@/core/api/client";
import { PaginatedData as PaginatedPayload } from "@/core/api/types";
import { API_BASE_URL } from "@/core/api/client";
import { getAccessToken } from "@/lib/auth";
import type {
  ChatMessage,
  ChatRequestPayload,
  ChatResponsePayload,
  ChatSession,
  ChatStreamEvent,
} from "@/features/chat/types/chat-types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type StreamEnvelope = {
  success: boolean;
  data?: ChatStreamEvent;
  error?: string | null;
  message?: string | null;
};

function parseEnvelopeFromLine(line: string): StreamEnvelope | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isObject(parsed)) return null;
    if (typeof parsed.success !== "boolean") return null;

    const data = parsed.data as ChatStreamEvent | undefined;
    const error = typeof parsed.error === "string" ? parsed.error : null;
    const message = typeof parsed.message === "string" ? parsed.message : null;

    return {
      success: parsed.success,
      data,
      error,
      message,
    };
  } catch {
    return null;
  }
}

export const chatService = {
  listSessions(limit = 20, offset = 0, repositoryId?: string, search?: string, isArchived?: boolean): Promise<PaginatedPayload<ChatSession>> {
    const params: Record<string, any> = { limit, offset };
    if (repositoryId) {
      params.repository_id = repositoryId;
    }
    if (search !== undefined) params.search = search;
    if (isArchived !== undefined) params.is_archived = isArchived;
    return apiClient<PaginatedPayload<ChatSession>>("/v1/chat/sessions", {
      params,
    });
  },

  getSession(sessionId: string): Promise<ChatSession> {
    return apiClient<ChatSession>(`/v1/chat/sessions/${sessionId}`);
  },

  updateSession(sessionId: string, payload: { session_title?: string; is_pinned?: boolean; is_archived?: boolean; session_mode?: string; metadata?: Record<string, unknown> }): Promise<ChatSession> {
    return apiClient<ChatSession>(`/v1/chat/sessions/${sessionId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  listMessages(sessionId: string, limit = 100, offset = 0): Promise<PaginatedPayload<ChatMessage>> {
    const safeLimit = Math.min(limit, 100);
    return apiClient<PaginatedPayload<ChatMessage>>(`/v1/chat/sessions/${sessionId}/messages`, {
      params: { limit: safeLimit, offset },
    });
  },

  deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
    return apiClient<{ deleted: boolean }>(`/v1/chat/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },

  createPatchDraft(
    repositoryId: string,
    payload: {
      base_commit_sha: string;
      patch_files: Array<{
        file_path: string;
        action: string;
        file_diff: string;
        content_hash_before?: string;
        content_hash_after?: string;
      }>;
    }
  ): Promise<{ patch_id: string; status: string; created_at: string }> {
    return apiClient<{ patch_id: string; status: string; created_at: string }>(
      `/v1/repositories/${repositoryId}/patches`,
      {
        method: "POST",
        body: payload,
      }
    );
  },

  validatePatch(
    repositoryId: string,
    patchId: string
  ): Promise<{ patch_id: string; status: string; validation_logs: string }> {
    return apiClient<{ patch_id: string; status: string; validation_logs: string }>(
      `/v1/repositories/${repositoryId}/patches/${patchId}/validate`,
      {
        method: "POST",
      }
    );
  },


  applyPatch(
    repositoryId: string,
    patchId: string
  ): Promise<{ patch_id: string; status: string }> {
    return apiClient<{ patch_id: string; status: string }>(
      `/v1/repositories/${repositoryId}/patches/${patchId}/apply`,
      {
        method: "POST",
      }
    );
  },

  cancelPatchDraft(
    repositoryId: string,
    patchId: string
  ): Promise<{ deleted: boolean }> {
    return apiClient<{ deleted: boolean }>(
      `/v1/repositories/${repositoryId}/patches/${patchId}`,
      {
        method: "DELETE",
      }
    );
  },

  send(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    return apiClient<ChatResponsePayload>("/v1/chat", {
      body: payload,
    });
  },

  async stream(
    payload: ChatRequestPayload,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = getAccessToken();
    if (!token) throw new Error("Missing access token");

    // API_BASE_URL is "/api/v1", so path is relative to that base (no /v1 prefix needed)
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let message = "Streaming request failed";
      try {
        const body = (await response.json()) as Record<string, unknown>;
        const detail = body.detail;
        const fallback = body.message;
        if (typeof detail === "string" && detail.length > 0) message = detail;
        else if (typeof fallback === "string" && fallback.length > 0) message = fallback;
      } catch {
        message = "Streaming request failed";
      }
      throw new Error(message);
    }

    if (!response.body) throw new Error("No response stream received");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const read = await reader.read();
      if (read.done) break;

      buffer += decoder.decode(read.value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;

        let dataStr = "";
        let eventType = "message";
        const lines = rawEvent.split("\n");
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr += line.slice(6);
          }
        }

        if (dataStr) {
          const envelope = parseEnvelopeFromLine(dataStr);
          if (!envelope) continue;
          if (!envelope.success) {
            throw new Error(envelope.message || envelope.error || "Stream failed");
          }
          if (envelope.data) onEvent(envelope.data);
        }
      }
    }

    const finalEvent = buffer.trim();
    if (finalEvent.length > 0) {
        let dataStr = "";
        const lines = finalEvent.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (dataStr) {
          const envelope = parseEnvelopeFromLine(dataStr);
          if (envelope && envelope.success && envelope.data) onEvent(envelope.data);
          if (envelope && !envelope.success) {
            throw new Error(envelope.message || envelope.error || "Stream failed");
          }
        }
    }
  },
};
