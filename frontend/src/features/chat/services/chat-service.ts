import { apiClient, ApiEnvelope } from '@/lib/api';
import { ChatResponse } from '../types/chat-types';

interface AskPayload {
  repository_id?: string;
  repo_id?: string;
  query: string;
  session_id?: string;
}

export const chatService = {
  getSessions: async () => {
    const res = await apiClient.get<ApiEnvelope<any[]>>('/chat/sessions');
    return res.data;
  },

  getSessionMessages: async (sessionId: string) => {
    const res = await apiClient.get<ApiEnvelope<any[]>>(`/chat/sessions/${sessionId}/messages`);
    return res.data;
  },

  deleteSession: async (sessionId: string) => {
     await apiClient.delete(`/chat/sessions/${sessionId}`);
  },

  ask: async (payload: AskPayload) => {
    const res = await apiClient.post<ApiEnvelope<ChatResponse>>('/chat', payload);
    return res.data;
  },

  streamChat: async (payload: AskPayload, onEvent: (event: any) => void) => {
    const response = await fetch(`${apiClient.defaults.baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiClient.defaults.headers.common['Authorization'] as string,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Streaming failed');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const envelope = JSON.parse(line);
          if (envelope.success && envelope.data) {
            onEvent(envelope.data);
          } else if (envelope.error) {
            throw new Error(envelope.error);
          }
        } catch (e) {
          console.error('Parse error in stream', e);
        }
      }
    }
  },
};
