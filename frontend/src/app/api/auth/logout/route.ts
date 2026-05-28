import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const jar = await cookies();
  jar.delete("tm_token");
  jar.delete("tm_role");

  return NextResponse.json({
    success: true,
    data: { logged_out: true },
    error: null,
  });
}
