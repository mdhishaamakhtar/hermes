/**
 * The organiser's JWT lives in localStorage for the API client and in a
 * same-name cookie that only proxy.ts reads, to gate protected routes before
 * they render. Both are written and cleared together, here and nowhere else.
 */

export const AUTH_COOKIE = "hermes_token";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_COOKIE);
}

export function setStoredAuthToken(token: string) {
  localStorage.setItem(AUTH_COOKIE, token);
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_COOKIE);
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Where to send an organiser after sign-in. Only same-site paths are honoured:
 * "//evil.example" and "https://…" fall back to the dashboard, so the login
 * page can never be used as an open redirect.
 */
export function safeReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  if (next.startsWith("/auth")) return "/dashboard";
  return next;
}
