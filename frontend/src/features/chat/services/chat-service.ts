import { apiClient, ApiEnvelope, PaginatedData } from '@/lib/api';
import { AskPayload, ChatResponse } from '../types/chat-types';

type PaginatedEnvelope<T> = ApiEnvelope<PaginatedData<T>>;

function unwrapPaginated<T>(response: { data: PaginatedEnvelope<T> }): PaginatedData<T> {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }

  const payload = response.data.data;
  if (!payload || !Array.isArray(payload.items) || !payload.pagination) {
    throw new Error('Invalid paginated response payload');
  }

  return payload;
}

async function fetchAllPages<T>(path: string, limit = 100): Promise<T[]> {
  let offset = 0;
  const items: T[] = [];

  while (true) {
    const response = await apiClient.get<PaginatedEnvelope<T>>(path, {
      params: { limit, offset },
    });
    const page = unwrapPaginated(response);
    items.push(...page.items);

    if (!page.pagination.has_more || page.items.length === 0) {
      break;
    }
    offset += limit;
  }

  return items;
}

export const chatService = {
  getSessions: async () => {
    return fetchAllPages<any>('/chat/sessions');
  },

  getSessionMessages: async (sessionId: string) => {
    return fetchAllPages<any>(`/chat/sessions/${sessionId}/messages`);
  },

  deleteSession: async (sessionId: string) => {
     await apiClient.delete(`/chat/sessions/${sessionId}`);
  },

  ask: async (payload: AskPayload) => {
    const res = await apiClient.post<ApiEnvelope<ChatResponse>>('/chat', payload);
    return res.data;
  },

  streamChat: async (payload: AskPayload, onEvent: (event: any) => void) => {
    const streamPath = '/chat/stream';
    const configuredBase = String(apiClient.defaults.baseURL || '').replace(/\/$/, '');
    const streamUrl = /^https?:\/\//i.test(configuredBase)
      ? `${configuredBase}${streamPath}`
      : `${streamPath}`;

    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      let detail = `Streaming failed (${response.status})`;
      try {
        const body = (await response.json()) as { detail?: string; error?: string };
        detail = body.detail || body.error || detail;
      } catch {
        // ignore parsing errors and return status-based fallback
      }
      throw new Error(detail);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Streaming unavailable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const parseLine = (line: string) => {
      const envelope = JSON.parse(line) as {
        success: boolean;
        data?: any;
        error?: string | null;
      };

      if (envelope.success && envelope.data) {
        onEvent(envelope.data);
        return;
      }

      if (!envelope.success) {
        throw new Error(envelope.error || 'Streaming failed');
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            parseLine(line);
          }
          newlineIndex = buffer.indexOf('\n');
        }

        if (done) break;
      }

      buffer += decoder.decode();
      const trailing = buffer.trim();
      if (trailing) {
        parseLine(trailing);
      }
    } finally {
      reader.releaseLock();
    }
  },
};
