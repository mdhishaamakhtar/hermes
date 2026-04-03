import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PATTERNS = [
  /^\/dashboard$/,
  /^\/events\/.+/,
  /^\/session\/[^/]+\/host$/,
  /^\/session\/[^/]+\/review$/,
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = PROTECTED_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  );

  if (!requiresAuth) {
    return NextResponse.next();
  }

  if (request.cookies.get("hermes_token")?.value) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/auth/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard", "/events/:path*", "/session/:path*"],
};
