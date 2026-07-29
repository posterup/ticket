import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Cookie presence only — deliberately no database.
 *
 * Prisma does not run on the Edge runtime without Accelerate, and a query per
 * request here would tax every navigation. This is a cheap redirect for the
 * common case; the real checks live one layer down and are not bypassable:
 * `app/(dashboard)/layout.tsx` calls `requireManager()`, and every route
 * handler calls its own guard. An expired-but-present cookie therefore slips
 * past this and is caught there, which is correct.
 */
const PROTECTED = ["/dashboard", "/me", "/tickets/create"];
const AUTH_PAGES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (!signedIn && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/events";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/me/:path*",
    "/tickets/create/:path*",
    "/login",
    "/signup",
  ],
};
