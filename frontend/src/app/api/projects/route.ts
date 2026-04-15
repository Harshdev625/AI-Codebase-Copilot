import { forwardJson } from "@/app/api/_shared/proxy";

export async function GET(request: Request): Promise<Response> {
  return forwardJson(request, "/projects", { method: "GET", includeBody: false });
}

export async function POST(request: Request): Promise<Response> {
  return forwardJson(request, "/projects", { method: "POST", includeBody: true });
}
