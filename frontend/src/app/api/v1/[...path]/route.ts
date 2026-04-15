import { cookies } from "next/headers";

const DEFAULT_BACKEND_BASE = "http://localhost:8000/v1";

function getBackendBaseUrl(): string {
  const configured =
    process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";

  if (!configured) {
    return DEFAULT_BACKEND_BASE;
  }

  return configured.replace(/\/$/, "");
}

function buildUpstreamUrl(pathParts: string[], request: Request): string {
  const base = getBackendBaseUrl();
  const url = new URL(request.url);
  const suffix = pathParts.map((part) => encodeURIComponent(part)).join("/");
  const search = url.search || "";
  return `${base}/${suffix}${search}`;
}

function shouldForwardBody(method: string): boolean {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD";
}

async function proxyToBackend(pathParts: string[], request: Request): Promise<Response> {
  const targetUrl = buildUpstreamUrl(pathParts, request);

  const outgoingHeaders = new Headers();
  const incomingHeaders = request.headers;

  const contentType = incomingHeaders.get("content-type");
  if (contentType) {
    outgoingHeaders.set("content-type", contentType);
  }

  const accept = incomingHeaders.get("accept");
  if (accept) {
    outgoingHeaders.set("accept", accept);
  }

  const requestId = incomingHeaders.get("x-request-id");
  if (requestId) {
    outgoingHeaders.set("x-request-id", requestId);
  }

  const explicitAuth = incomingHeaders.get("authorization");
  if (explicitAuth) {
    outgoingHeaders.set("authorization", explicitAuth);
  } else {
    const token = (await cookies()).get("tm_token")?.value;
    if (token) {
      outgoingHeaders.set("authorization", `Bearer ${token}`);
    }
  }

  let body: ArrayBuffer | undefined;
  if (shouldForwardBody(request.method)) {
    body = await request.arrayBuffer();
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: outgoingHeaders,
      body,
      cache: "no-store",
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        data: null,
        error: "Upstream backend unavailable",
        status: 503,
        message: error instanceof Error ? error.message : "Backend request failed",
      },
      { status: 503 }
    );
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "cache-control",
    "x-request-id",
    "x-accel-buffering",
  ];
  for (const header of passthroughHeaders) {
    const value = upstreamResponse.headers.get(header);
    if (value) {
      responseHeaders.set(header, value);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

type RouteContext = {
  params: Promise<unknown>;
};

function extractPathSegments(params: unknown): string[] {
  if (!params || typeof params !== "object") {
    return [];
  }

  const candidate = (params as { path?: unknown }).path;
  if (Array.isArray(candidate)) {
    return candidate.filter((part): part is string => typeof part === "string");
  }

  return [];
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}

export async function OPTIONS(request: Request, context: RouteContext): Promise<Response> {
  const path = extractPathSegments(await context.params);
  return proxyToBackend(path, request);
}
