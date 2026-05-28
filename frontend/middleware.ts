import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_PATHS = ["/login", "/register"];
const ADMIN_AUTH_PATHS = ["/admin/login", "/admin/register"];
const USER_PATHS = ["/dashboard", "/repositories", "/chat"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("tm_token")?.value;
  const role = String(request.cookies.get("tm_role")?.value ?? "").toUpperCase();

  const isAuthPath = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAdminAuthPath = ADMIN_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isUserPath = USER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
    return NextResponse.next();
  }

  if (isAdminPath) {
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isUserPath && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
