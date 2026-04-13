/**
 * proxy.ts — Shared Next.js API route helper.
 *
 * All Next.js /api/* routes use this module to forward requests to the FastAPI
 * backend. It handles:
 *   - Auth header forwarding
 *   - Correct Content-Type passing
 *   - Error normalization into { success, data, error } envelope
 *   - Streaming (ReadableStream passthrough) for NDJSON endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

/** Build the full backend URL by appending `path` to the configured base URL. */
function backendUrl(path: string): string {
  const base = getBackendUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base + normalizedPath;
}

function forwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = request.headers.get("authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }
  return headers;
}

/**
 * Forward a standard (non-streaming) request to the backend and return its
 * response wrapped in a NextResponse. The response body and status code are
 * passed through unchanged so the frontend HTTP client receives the same
 * `{ success, data, error }` envelope that FastAPI produces.
 */
export async function proxyRequest(
  request: NextRequest,
  backendPath: string,
  options: {
    method?: string;
    /** Override URL path params if the backend path differs from the Next.js path */
    body?: BodyInit | null;
  } = {}
): Promise<NextResponse> {
  const method = options.method ?? request.method;
  let body: BodyInit | null | undefined = undefined;

  if (method !== "GET" && method !== "HEAD") {
    if (options.body !== undefined) {
      body = options.body;
    } else {
      try {
        const text = await request.text();
        body = text || undefined;
      } catch {
        body = undefined;
      }
    }
  }

  try {
    const response = await fetch(backendUrl(backendPath), {
      method,
      headers: forwardHeaders(request),
      body,
      cache: "no-store",
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend unreachable";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 503 }
    );
  }
}

/**
 * Forward a streaming request (NDJSON) to the backend.
 * Uses ReadableStream to pass chunks through incrementally so the browser
 * receives real-time streaming events from FastAPI.
 */
export async function proxyStream(
  request: NextRequest,
  backendPath: string
): Promise<NextResponse> {
  let body: string | undefined;
  try {
    body = await request.text();
  } catch {
    body = undefined;
  }

  try {
    const backendResponse = await fetch(backendUrl(backendPath), {
      method: "POST",
      headers: forwardHeaders(request),
      body,
      cache: "no-store",
    });

    if (!backendResponse.ok || !backendResponse.body) {
      const text = await backendResponse.text();
      return new NextResponse(text || JSON.stringify({ success: false, data: null, error: "Backend stream failed" }), {
        status: backendResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pipe the backend ReadableStream directly to the client response.
    const { readable, writable } = new TransformStream();
    backendResponse.body.pipeTo(writable).catch(() => {/* ignore pipe errors on client disconnect */});

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend unreachable";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 503 }
    );
  }
}
