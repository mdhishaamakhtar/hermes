import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

/** Organiser-only pages. Player routes (play, results) stay open. */
const ORGANISER_ONLY = [
  /^\/dashboard$/,
  /^\/events\/.+/,
  /^\/session\/[^/]+\/(host|review)$/,
];

/*
 * A first, cheap gate on the auth cookie. It cannot tell an expired token
 * from a live one; OrganiserShell handles that when the API answers 401.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (signedIn && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!signedIn && ORGANISER_ONLY.some((pattern) => pattern.test(pathname))) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/events/:path*", "/session/:path*", "/auth/:path*"],
};
