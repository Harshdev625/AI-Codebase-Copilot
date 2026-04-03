import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

type Params = { params: Promise<{ snapshotId: string }> };

export async function GET(request: NextRequest, context: Params) {
  const { snapshotId } = await context.params;
  return proxyRequest(request, `/index/progress/${snapshotId}`);
}
