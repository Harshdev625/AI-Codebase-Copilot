import { chatService } from '@/features/chat/services/chat-service';
import { apiClient, API_BASE_URL } from '@/core/api/client';
import { getAccessToken } from '@/lib/auth';

jest.mock('@/core/api/client', () => ({
  apiClient: jest.fn(),
  API_BASE_URL: '/api/v1',
}));

jest.mock('@/lib/auth', () => ({
  getAccessToken: jest.fn(),
}));

import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

Object.assign(global, { TextEncoder, TextDecoder, ReadableStream });

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls listSessions API without repositoryId', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await chatService.listSessions(10, 5);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/sessions', {
      params: { limit: 10, offset: 5 },
    });
  });

  it('calls listSessions API with repositoryId', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await chatService.listSessions(10, 5, 'repo-1');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/sessions', {
      params: { limit: 10, offset: 5, repository_id: 'repo-1' },
    });
  });

  it('calls listMessages API', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await chatService.listMessages('session-1', 50, 0);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/sessions/session-1/messages', {
      params: { limit: 50, offset: 0 },
    });
  });

  it('calls listMessages API clamping limit to 100', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({ items: [], total: 0 });

    await chatService.listMessages('session-1', 200, 0);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/sessions/session-1/messages', {
      params: { limit: 100, offset: 0 },
    });
  });

  it('calls deleteSession API', async () => {
    const mockResponse = { deleted: true };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await chatService.deleteSession('session-1');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/sessions/session-1', {
      method: 'DELETE',
    });
  });

  it('calls applyPatch API', async () => {
    const mockResponse = { applied: true, message: 'ok' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await chatService.applyPatch('repo-1', 'diff');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat/apply-patch', {
      body: { repository_id: 'repo-1', diff: 'diff' },
    });
  });

  it('calls send API', async () => {
    const mockResponse = { id: 'msg', role: 'assistant', content: 'hello', metadata: {} };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const payload = { query: 'hi', mode: 'question' as const };
    const result = await chatService.send(payload);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/chat', {
      body: payload,
    });
  });

  describe('stream', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('throws if no access token', async () => {
      (getAccessToken as jest.Mock).mockReturnValue(null);
      await expect(chatService.stream({ query: 'hi', mode: 'question' }, jest.fn())).rejects.toThrow('Missing access token');
    });

    it('throws if response not ok', async () => {
      (getAccessToken as jest.Mock).mockReturnValue('token');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Custom error' }),
      });

      await expect(chatService.stream({ query: 'hi', mode: 'question' }, jest.fn())).rejects.toThrow('Custom error');
    });

    it('processes stream chunks correctly', async () => {
      (getAccessToken as jest.Mock).mockReturnValue('token');

      const mockChunks = [
        '{"success":true,"data":{"type":"chunk","delta":"hello "}}\n',
        '{"success":true,"data":{"type":"chunk","delta":"world"}}\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockChunks[0]));
          controller.enqueue(new TextEncoder().encode(mockChunks[1]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const onEvent = jest.fn();
      await chatService.stream({ query: 'hi', mode: 'question' }, onEvent);

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent).toHaveBeenNthCalledWith(1, { type: 'chunk', delta: 'hello ' });
      expect(onEvent).toHaveBeenNthCalledWith(2, { type: 'chunk', delta: 'world' });
    });
    
    it('throws on failed stream chunk', async () => {
      (getAccessToken as jest.Mock).mockReturnValue('token');

      const mockChunks = [
        '{"success":true,"data":{"type":"chunk","delta":"hello "}}\n',
        '{"success":false,"error":"Stream failed mid-way"}\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockChunks[0]));
          controller.enqueue(new TextEncoder().encode(mockChunks[1]));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const onEvent = jest.fn();
      await expect(chatService.stream({ query: 'hi', mode: 'question' }, onEvent)).rejects.toThrow('Stream failed mid-way');
      expect(onEvent).toHaveBeenCalledTimes(1); // The first chunk was processed
    });
  });
});
