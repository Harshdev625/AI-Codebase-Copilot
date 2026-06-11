import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isStudioEnabled } from "./src/lib/feature-flags";

const AUTH_PATHS = ["/login", "/register"];
const ADMIN_AUTH_PATHS = ["/admin/login", "/admin/register"];
const USER_PATHS = ["/workspace", "/studio", "/dashboard"];

/**
 * Decode the JWT payload and return true if the token is valid and not expired.
 * Runs at the edge without any crypto library - just base64-decodes the payload.
 */
function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    const exp = payload?.exp;
    if (typeof exp !== "number") return false;
    // exp is in seconds; Date.now() is in milliseconds
    return Date.now() / 1000 < exp;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get("tm_token")?.value;
  const role = String(request.cookies.get("tm_role")?.value ?? "").toUpperCase();

  // An expired token must be treated the same as no token
  const token = isTokenValid(rawToken) ? rawToken : undefined;

  const isAuthPath = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isAdminAuthPath = ADMIN_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isUserPath = USER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminAuthPath) {
    if (token) {
      const redirectPath = role === "ADMIN" ? "/admin/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.next();
  }

  if (isAuthPath) {
    if (token) {
      const redirectPath = role === "ADMIN" ? "/admin/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    if (rawToken && !token) {
      const response = NextResponse.next();
      response.cookies.delete("tm_token");
      response.cookies.delete("tm_role");
      return response;
    }
    return NextResponse.next();
  }

  if (isAdminPath) {
    if (!token) {
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      if (rawToken) {
        response.cookies.delete("tm_token");
        response.cookies.delete("tm_role");
      }
      return response;
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isUserPath && !token) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (rawToken) {
      response.cookies.delete("tm_token");
      response.cookies.delete("tm_role");
    }
    return response;
  }

  // Phase 0: /studio is auth-protected but redirects to /workspace when the flag is off.
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    if (!isStudioEnabled()) {
      const redirectUrl = new URL("/workspace", request.url);
      redirectUrl.search = request.nextUrl.search;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
