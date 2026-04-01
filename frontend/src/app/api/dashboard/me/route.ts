import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: NextRequest) {
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/dashboard/me`, {
    headers: { Authorization: authorization },
  });

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
