import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, context: Params) {
  const { userId } = await context.params;
  const payload = await request.json();
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/admin/users/${userId}/role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
