import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-url";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;
  const backend = getBackendUrl();
  const authorization = request.headers.get("authorization") ?? "";

  try {
    const response = await fetch(`${backend}/index/progress/${snapshotId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
    });

    const data = await response.json();
    return new NextResponse(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Progress fetch error:", error);
    return new NextResponse(JSON.stringify({ error: "Failed to fetch progress" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
