import { forwardJson } from "@/app/api/_shared/proxy";

export async function POST(request: Request): Promise<Response> {
  return forwardJson(request, "/index", { method: "POST", includeBody: true });
}
