import { getBackendUrl } from "@/lib/backend-url";

export async function forwardJson(
  request: Request,
  backendPath: string,
  options?: {
    method?: string;
    headers?: HeadersInit;
    includeBody?: boolean;
  }
): Promise<Response> {
  const target = `${getBackendUrl()}${backendPath.startsWith("/") ? backendPath : `/${backendPath}`}`;
  const method = options?.method ?? request.method;
  const includeBody = options?.includeBody ?? (method !== "GET" && method !== "HEAD");

  const headers = new Headers(options?.headers || {});
  const auth = request.headers.get("authorization");
  if (auth && !headers.has("Authorization")) {
    headers.set("Authorization", auth);
  }
  const contentType = request.headers.get("content-type");
  if (contentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", contentType);
  }

  const body = includeBody ? await request.text() : undefined;

  const upstream = await fetch(target, {
    method,
    headers,
    ...(includeBody ? { body } : {}),
  });

  const responseBody = await upstream.text();
  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type") || "application/json";
  responseHeaders.set("Content-Type", upstreamType);

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
