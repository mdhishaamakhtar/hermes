import ky, { isHTTPError } from "ky";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/auth-storage";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/**
 * The envelope the backend wraps every response in. Internal to this module —
 * callers never see it, because `request` unwraps success and throws failure.
 */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * Every API failure, whether the server rejected the request or it never
 * arrived.
 *
 * `status` is the discriminator that matters to callers:
 *   - set        → the server responded and refused (bad credentials, 404, …).
 *                  `message` is the server's own, and is safe to show a user.
 *   - undefined  → the request never completed (offline, DNS, CORS, timeout).
 *                  `message` is a fetch-level string; show your own copy.
 */
export class HermesError extends Error {
  readonly status?: number;
  readonly code: string;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "HermesError";
    this.code = code;
    this.status = status;
  }

  /** True when the server responded, however unhappily. */
  get isFromServer(): boolean {
    return this.status !== undefined;
  }
}

/**
 * The message worth showing a user: the server's own when it sent one,
 * otherwise `fallback`.
 *
 * Network-level text ("Failed to fetch", "NetworkError when attempting…")
 * never reaches the UI — it names a cause the user cannot act on.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HermesError && error.isFromServer) {
    return error.message || fallback;
  }
  return fallback;
}

export function getAuthToken(): string | null {
  return getStoredAuthToken();
}

const kyInstance = ky.create({
  prefix: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // SWR owns retries for reads; a second retry layer here would multiply them.
  retry: 0,
  hooks: {
    beforeRequest: [
      ({ request, options }) => {
        if (options.context.skipAuth) return;
        const token = getAuthToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
  },
});

// An expired/invalid organizer token: clear it and send the user back to
// login. Skipped for anonymous flows (no stored token) and skipAuth requests
// like login itself, where a 401 means bad credentials, not a dead session.
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  if (!getStoredAuthToken()) return;
  clearStoredAuthToken();
  window.location.assign("/auth/login");
}

/**
 * Resolves to the unwrapped payload, or throws {@link HermesError}.
 *
 * 204s and bodiless responses resolve to `undefined`; call those as
 * `api.post<void>(…)`.
 */
async function request<T>(
  send: () => Promise<Response>,
  { expectNoBody = false, skipAuth = false } = {},
): Promise<T> {
  let response: Response;

  try {
    response = await send();
  } catch (error) {
    if (!isHTTPError(error)) {
      throw new HermesError(
        error instanceof Error ? error.message : "An unknown error occurred",
        "NETWORK_ERROR",
      );
    }

    const status = error.response.status;
    if (status === 401 && !skipAuth) handleUnauthorized();

    // Prefer the server's own error message when it sent an envelope. ky has
    // already consumed the body into `data`; non-JSON bodies arrive as text.
    const envelope =
      typeof error.data === "object" && error.data !== null
        ? (error.data as ApiEnvelope<never>)
        : null;

    if (envelope?.error) {
      throw new HermesError(
        envelope.error.message,
        envelope.error.code,
        status,
      );
    }
    throw new HermesError(error.message, "HTTP_ERROR", status);
  }

  if (expectNoBody || response.status === 204) {
    return undefined as T;
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!envelope.success) {
    throw new HermesError(
      envelope.error?.message ?? "Request failed",
      envelope.error?.code ?? "UNKNOWN_ERROR",
      response.status,
    );
  }
  return envelope.data;
}

export const api = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    request<T>(() => kyInstance.get(path, { headers: extraHeaders })),

  post: <T>(path: string, body?: unknown, opts?: { skipAuth?: boolean }) =>
    request<T>(
      () =>
        kyInstance.post(path, {
          json: body,
          context: { skipAuth: opts?.skipAuth ?? false },
        }),
      { expectNoBody: !body, skipAuth: opts?.skipAuth },
    ),

  put: <T>(path: string, body?: unknown) =>
    request<T>(() => kyInstance.put(path, { json: body })),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(() => kyInstance.patch(path, { json: body })),

  delete: <T = void>(path: string) =>
    request<T>(() => kyInstance.delete(path), {
      expectNoBody: true,
    }),
};
