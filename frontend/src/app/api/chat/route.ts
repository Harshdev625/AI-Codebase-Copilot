import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/chat");
}
