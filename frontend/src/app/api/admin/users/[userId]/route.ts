import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

type Params = { params: Promise<{ userId: string }> };

export async function DELETE(request: NextRequest, context: Params) {
  const { userId } = await context.params;
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: authorization },
  });

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
