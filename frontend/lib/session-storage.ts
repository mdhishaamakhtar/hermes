"use client";

const SESSION_JOIN_CODE_PREFIX = "hermes_session_";
const REJOIN_TOKEN_PREFIX = "hermes_rejoin_";

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function sessionJoinCodeKey(sessionId: string | number) {
  return `${SESSION_JOIN_CODE_PREFIX}${sessionId}`;
}

function rejoinTokenKey(sessionId: string | number) {
  return `${REJOIN_TOKEN_PREFIX}${sessionId}`;
}

export function getStoredSessionJoinCode(sessionId: string | number) {
  if (!hasLocalStorage()) return "";
  return localStorage.getItem(sessionJoinCodeKey(sessionId)) ?? "";
}

export function storeSessionJoinCode(
  sessionId: string | number,
  joinCode: string,
) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(sessionJoinCodeKey(sessionId), joinCode);
}

export function getStoredRejoinToken(sessionId: string | number) {
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(rejoinTokenKey(sessionId));
}

export function storeRejoinToken(
  sessionId: string | number,
  rejoinToken: string,
) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(rejoinTokenKey(sessionId), rejoinToken);
}

export function removeStoredRejoinToken(sessionId: string | number) {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(rejoinTokenKey(sessionId));
}

export function listStoredRejoinTokens() {
  if (!hasLocalStorage()) return [];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(REJOIN_TOKEN_PREFIX))
    .map((key) => ({
      sessionId: key.slice(REJOIN_TOKEN_PREFIX.length),
      token: localStorage.getItem(key),
    }))
    .filter((entry): entry is { sessionId: string; token: string } =>
      Boolean(entry.token),
    );
}
