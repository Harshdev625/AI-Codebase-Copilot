import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") || "";
  const upstream = await fetch(`${getBackendUrl()}/auth/me`, {
    headers: {
      Authorization: auth,
    },
  });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
}
