import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: Params) {
  const { projectId } = await context.params;
  return proxyRequest(request, `/projects/${projectId}/repositories`);
}

export async function POST(request: NextRequest, context: Params) {
  const { projectId } = await context.params;
  return proxyRequest(request, `/projects/${projectId}/repositories`);
}
