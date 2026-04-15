import { forwardJson } from "@/app/api/_shared/proxy";

type Context = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: Context): Promise<Response> {
  const { projectId } = await context.params;
  return forwardJson(request, `/projects/${projectId}/repositories`, { method: "GET", includeBody: false });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const { projectId } = await context.params;
  return forwardJson(request, `/projects/${projectId}/repositories`, { method: "POST", includeBody: true });
}
