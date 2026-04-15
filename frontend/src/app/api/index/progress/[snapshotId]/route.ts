import { getBackendUrl } from "@/lib/backend-url";

type Context = {
  params: Promise<{ snapshotId: string }>;
};

export async function GET(request: Request, context: Context): Promise<Response> {
  const { snapshotId } = await context.params;
  const auth = request.headers.get("authorization") || "";

  try {
    const upstream = await fetch(`${getBackendUrl()}/index/progress/${snapshotId}`, {
      method: "GET",
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
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch progress" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
