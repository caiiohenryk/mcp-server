import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: redirects visitors without a session cookie to /login.
 * The authoritative check (session + allowlist) is `requireUser()` on the server.
 * The MCP endpoint (/api/mcp) authenticates with Bearer tokens and is NOT handled here.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/tokens/:path*", "/standards/:path*", "/admin/:path*", "/connect/:path*"],
};
