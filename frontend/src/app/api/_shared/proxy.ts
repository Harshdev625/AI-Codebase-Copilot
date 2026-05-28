const DEFAULT_BACKEND_BASE = "http://localhost:8000/v1";

function getBackendBaseUrl(): string {
  const configured =
    process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";

  return (configured || DEFAULT_BACKEND_BASE).replace(/\/$/, "");
}

export async function forwardJson(
  request: Request,
  path: string,
  opts: { method: string; includeBody?: boolean } = { method: "GET" }
): Promise<Response> {
  const backend = getBackendBaseUrl();
  const url = `${backend}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const body = opts.includeBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(url, {
    method: opts.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

