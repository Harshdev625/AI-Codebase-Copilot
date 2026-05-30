import { apiClient, API_BASE_URL } from '@/core/api/client';
import { ApiError } from '@/core/api/types';
import { globalEvents, EVENTS } from '@/lib/events';
import { getAccessToken } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  getAccessToken: jest.fn(() => null),
}));

jest.mock('@/lib/events', () => ({
  globalEvents: {
    emit: jest.fn(),
  },
  EVENTS: {
    UNAUTHORIZED: 'UNAUTHORIZED',
  },
}));

describe('apiClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('makes a successful GET request and parses JSON', async () => {
    const mockData = { id: 1, name: 'Test' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await apiClient('/test-endpoint');
    expect(result).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('makes a successful POST request with body', async () => {
    const mockData = { id: 2, name: 'bar' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = { foo: 'bar' };
    const result = await apiClient('/submit', { body });
    expect(result).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/submit'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  });

  it('adds query parameters correctly', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await apiClient('/search', { params: { q: 'test', page: 1, filter: undefined } });
    
    // Check that the URL contains the query params
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('q=test');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).not.toContain('filter');
  });

  it('includes auth token if available', async () => {
    (getAccessToken as jest.Mock).mockReturnValueOnce('mock-jwt-token');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await apiClient('/protected');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-jwt-token',
        }),
      })
    );
  });

  it('handles ApiEnvelope success responses', async () => {
    const mockData = { success: true, data: { val: 42 } };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await apiClient('/envelope');
    expect(result).toEqual({ val: 42 });
  });

  it('handles ApiEnvelope error responses (HTTP 200 but success: false)', async () => {
    const mockData = { success: false, error: { message: 'Logic error', code: 'ERR' } };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const p = apiClient('/envelope');
    await expect(p).rejects.toThrow(ApiError);
    // we can't test it twice without two mocks, so one is enough
  });

  it('emits UNAUTHORIZED event on 401 response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient('/secret')).rejects.toThrow(ApiError);
    expect(globalEvents.emit).toHaveBeenCalledWith(EVENTS.UNAUTHORIZED);
  });

  it('handles structured backend errors (HTTP 400)', async () => {
    const mockData = { success: false, error: { message: 'Bad request', code: 'BAD' } };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient('/bad')).rejects.toThrow('Bad request');
  });

  it('handles unstructured detail errors (HTTP 403)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient('/forbidden')).rejects.toThrow('Forbidden');
  });

  it('handles non-JSON error responses', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(apiClient('/error')).rejects.toThrow('Internal Server Error');
  });

  it('handles network errors', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiClient('/network')).rejects.toThrow('Network error. Please check your connection.');
  });
});
