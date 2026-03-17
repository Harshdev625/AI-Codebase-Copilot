import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: NextRequest) {
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/projects`, {
    headers: { Authorization: authorization },
  });
  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";
  const payload = await request.json();

  const response = await fetch(`${backend}/projects`, {
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
