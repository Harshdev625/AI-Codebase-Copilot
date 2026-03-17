import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/projects/${projectId}/repositories`, {
    headers: { Authorization: authorization }
  });
  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(request: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const payload = await request.json();
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${backend}/projects/${projectId}/repositories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization
    },
    body: JSON.stringify(payload)
  });

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: { "Content-Type": "application/json" }
  });
}
