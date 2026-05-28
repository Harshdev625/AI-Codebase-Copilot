import { getFrontendApiBase } from '@/lib/api-proxy';
import { getAccessToken } from '@/lib/auth';
import { globalEvents, EVENTS } from '@/lib/events';
import { ApiError, ApiEnvelope } from './types';

export const API_BASE_URL = getFrontendApiBase();

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Normalizes an API path to ensure it starts with a leading slash.
 * Service modules pass paths like "/v1/auth/login". The API_BASE_URL
 * is "/api/v1" so we strip the /v1 prefix from the path before
 * appending it to the base URL to avoid double-prefixing.
 */
function normalizePath(path: string): string {
  let normalized = String(path || '').trim();
  if (!normalized) return '/';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  // Strip /v1 prefix since API_BASE_URL already includes /api/v1
  if (normalized === '/v1') return '/';
  if (normalized.startsWith('/v1/')) return normalized.slice(3);
  return normalized;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const normalizedPath = normalizePath(path);
  
  // Combine base and path ensuring single slash
  let fullPath = API_BASE_URL;
  if (fullPath.endsWith('/')) {
    fullPath = fullPath.slice(0, -1);
  }
  fullPath += normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

  let absoluteBase = fullPath;
  if (!/^https?:\/\//i.test(absoluteBase)) {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    absoluteBase = `${origin}${fullPath.startsWith("/") ? "" : "/"}${fullPath}`;
  }
  
  const url = new URL(absoluteBase);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  // If original API_BASE_URL was relative, return relative URL in browser
  const isRelative = !/^https?:\/\//i.test(API_BASE_URL);
  if (isRelative && typeof window !== "undefined") {
    return url.pathname + url.search;
  }
  
  return url.toString();
}

/**
 * Core API Client built on Fetch (replaces Axios).
 */
export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...customConfig } = options;
  const token = getAccessToken();

  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const config: RequestInit = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Request-ID': requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = buildUrl(endpoint, params);

  try {
    const response = await fetch(url, config);

    // Parse JSON safely
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        globalEvents.emit(EVENTS.UNAUTHORIZED);
      }

      // Handle structured backend errors
      if (isJson && data && typeof data === 'object') {
        const env = data as ApiEnvelope<any>;
        if (!env.success && env.error) {
          throw new ApiError(env.error.message, response.status, env.error.code, env.error.details);
        }
        // Fallback for non-envelope json errors
        if ((data as any).detail) {
           throw new ApiError(String((data as any).detail), response.status);
        }
      }
      
      throw new ApiError(typeof data === 'string' ? data : 'Request failed', response.status);
    }

    // Success response wrapper handling
    if (isJson && data && typeof data === 'object' && 'success' in data) {
       const env = data as ApiEnvelope<T>;
       if (env.success) {
         return env.data;
       }
       throw new ApiError(env.error?.message || 'Request failed', response.status, env.error?.code, env.error?.details);
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
    }
    if ((error as any).name === 'AbortError') {
      throw new ApiError('Request cancelled.', 0, 'ABORT_ERROR');
    }
    throw new ApiError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}
