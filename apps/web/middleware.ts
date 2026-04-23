import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/lobby", "/install", "/status"];

// Lightweight cookie-presence check. We intentionally avoid importing
// @supabase/ssr here because it pulls in transitive deps that break the
// Edge runtime (__dirname) and also don't resolve cleanly under Node ESM
// (next/server subpath). Actual auth validation still happens in server
// components via createServerClient — this middleware only decides whether
// to short-circuit protected paths to /login when there's obviously no
// session cookie at all.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Supabase SSR stores the session under cookies named
  // `sb-<project-ref>-auth-token` (and sometimes chunked `.0`, `.1` suffixes).
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
