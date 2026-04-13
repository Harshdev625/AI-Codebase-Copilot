import { NextRequest } from "next/server";
import { proxyStream } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  return proxyStream(request, "/chat/stream");
}
