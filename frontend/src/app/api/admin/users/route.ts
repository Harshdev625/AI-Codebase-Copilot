import { forwardJson } from "@/app/api/_shared/proxy";

export async function GET(request: Request): Promise<Response> {
  return forwardJson(request, "/admin/users", { method: "GET", includeBody: false });
}
