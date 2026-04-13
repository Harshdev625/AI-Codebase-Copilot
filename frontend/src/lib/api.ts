import { getToken, handleUnauthorizedResponse } from "@/lib/auth";
import { apiRequest, requireData } from "@/lib/http";

export type ChatPayload = {
  repo_id: string;
  query: string;
};

type ChatStreamStartEvent = {
  type: "start";
  intent?: string;
};

type ChatStreamChunkEvent = {
  type: "chunk";
  delta: string;
};

type ChatStreamDoneEvent = {
  type: "done";
  intent?: string;
  sources?: Array<{ path?: string; symbol?: string }>;
};

type ChatStreamErrorEvent = {
  type: "error";
  message?: string;
};

type ChatStreamEvent = ChatStreamStartEvent | ChatStreamChunkEvent | ChatStreamDoneEvent | ChatStreamErrorEvent;

type StreamEnvelope = {
  success: boolean;
  data: ChatStreamEvent | null;
  error: string | null;
};

function toStreamEvent(raw: unknown): ChatStreamEvent {
  if (!raw || typeof raw !== "object") {
    throw new Error("Received malformed streaming event.");
  }

  const obj = raw as Record<string, unknown>;
  if ("success" in obj && "data" in obj && "error" in obj) {
    const envelope = obj as StreamEnvelope;
    if (!envelope.success) {
      throw new Error(envelope.error || "Streaming failed.");
    }
    if (!envelope.data) {
      throw new Error("Received empty streaming payload.");
    }
    return envelope.data;
  }

  return obj as ChatStreamEvent;
}

export type StreamChatHandlers = {
  onStart?: (event: ChatStreamStartEvent) => void;
  onChunk?: (delta: string) => void;
  onDone?: (event: ChatStreamDoneEvent) => void;
};

export async function sendChat(payload: ChatPayload) {
  const result = await apiRequest<{ answer: string; intent: string; sources: Array<{ path?: string; symbol?: string }> }>("/api/chat", {
    method: "POST",
    body: payload,
  });
  return requireData(result, "Failed to call backend.");
}

export async function streamChat(payload: ChatPayload, handlers: StreamChatHandlers = {}) {
  const token = getToken();
  const res = await fetch(`/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (handleUnauthorizedResponse(res)) {
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const message = await res.text();
    try {
      const parsed = JSON.parse(message);
      throw new Error(parsed?.error || parsed?.detail || "Failed to call backend.");
    } catch {
      throw new Error(message || "Failed to call backend.");
    }
  }

  if (!res.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        let event: ChatStreamEvent;
        try {
          event = toStreamEvent(JSON.parse(line));
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : "Received malformed streaming event.");
        }

        if (event.type === "start") {
          handlers.onStart?.(event);
        } else if (event.type === "chunk") {
          handlers.onChunk?.(event.delta || "");
        } else if (event.type === "done") {
          handlers.onDone?.(event);
          return;
        } else if (event.type === "error") {
          throw new Error(event.message || "Streaming failed.");
        }
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    try {
      const event = toStreamEvent(JSON.parse(trailing));
      if (event.type === "done") {
        handlers.onDone?.(event);
        return;
      }
      if (event.type === "error") {
        throw new Error(event.message || "Streaming failed.");
      }
      if (event.type === "start") {
        handlers.onStart?.(event);
      }
      if (event.type === "chunk") {
        handlers.onChunk?.(event.delta || "");
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Received malformed trailing streaming event.");
    }
  }

  throw new Error("Streaming ended before completion.");
}

export type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  access_token: string;
  token_type?: string;
};

export async function login(payload: LoginPayload) {
  const result = await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    body: payload,
    withAuth: false,
  });
  const data = requireData(result, "Login failed");
  if (!data || typeof data !== "object" || typeof (data as LoginResponse).access_token !== "string") {
    throw new Error("Login failed");
  }
  return data as LoginResponse;
}

export async function getAdminMetrics(token: string) {
  const result = await apiRequest<Record<string, number>>(`/api/admin/system-metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return requireData(result, "Failed to fetch admin metrics");
}
