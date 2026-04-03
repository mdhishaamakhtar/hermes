"use client";

const AUTH_COOKIE_NAME = "hermes_token";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_COOKIE_NAME);
}

export function setStoredAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_COOKIE_NAME, token);
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_COOKIE_NAME);
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
