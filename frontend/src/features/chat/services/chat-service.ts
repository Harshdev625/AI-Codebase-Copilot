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
  listSessions(limit = 20, offset = 0, repositoryId?: string): Promise<PaginatedPayload<ChatSession>> {
    const params: Record<string, any> = { limit, offset };
    if (repositoryId) {
      params.repository_id = repositoryId;
    }
    return apiClient<PaginatedPayload<ChatSession>>("/v1/chat/sessions", {
      params,
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

  applyPatch(repositoryId: string, diff: string): Promise<{ applied: boolean; message: string }> {
    return apiClient<{ applied: boolean; message: string }>("/v1/chat/apply-patch", {
      body: { repository_id: repositoryId, diff },
    });
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
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const envelope = parseEnvelopeFromLine(line);
        if (!envelope) continue;
        if (!envelope.success) {
          throw new Error(envelope.message || envelope.error || "Stream failed");
        }
        if (envelope.data) onEvent(envelope.data);
      }
    }

    const finalLine = buffer.trim();
    if (finalLine.length > 0) {
      const envelope = parseEnvelopeFromLine(finalLine);
      if (envelope && envelope.success && envelope.data) onEvent(envelope.data);
      if (envelope && !envelope.success) {
        throw new Error(envelope.message || envelope.error || "Stream failed");
      }
    }
  },
};
