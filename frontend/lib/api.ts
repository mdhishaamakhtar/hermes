import ky, { isHTTPError } from "ky";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/**
 * The envelope the backend wraps every response in. Internal to this module:
 * callers never see it, because `request` unwraps success and throws failure.
 */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * Every API failure, whether the server refused the request or it never
 * arrived.
 *
 *   status set        the server answered and refused. Its `message` is
 *                     written for people and safe to show.
 *   status undefined  the request never completed (offline, DNS, CORS,
 *                     timeout). The message names a cause nobody can act on.
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

  get isFromServer(): boolean {
    return this.status !== undefined;
  }
}

/** The HTTP status of a failed call, or undefined when nothing came back. */
export function errorStatus(error: unknown): number | undefined {
  return error instanceof HermesError ? error.status : undefined;
}

/**
 * The sentence to show a person when a call fails. The server's own words
 * for a refusal; our words for an outage or a crash, because "Failed to
 * fetch" and "An unexpected error occurred" help no one.
 */
export function describeError(error: unknown, fallback: string): string {
  if (!(error instanceof HermesError) || !error.isFromServer) {
    return "Can't reach Hermes. Check your connection and try again.";
  }
  if (error.status !== undefined && error.status >= 500) {
    return "Hermes hit a problem on its side. Try again in a moment.";
  }
  return error.message || fallback;
}

/*
 * A 401 on an authenticated call means the organiser's token died. The fetch
 * layer cannot navigate, so it clears the token and tells whoever registered;
 * Providers registers the handler that resets the cache and routes to login.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function onUnauthorized(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function handleUnauthorized() {
  // No stored token means an anonymous flow, where a 401 is a plain refusal.
  if (!getStoredAuthToken()) return;
  clearStoredAuthToken();
  unauthorizedHandler?.();
}

const client = ky.create({
  prefix: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // SWR owns retries for reads; a second retry layer would multiply them.
  retry: 0,
  hooks: {
    beforeRequest: [
      ({ request, options }) => {
        if (options.context.skipAuth) return;
        const token = getStoredAuthToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
  },
});

/**
 * Resolves to the unwrapped payload, or throws {@link HermesError}.
 * 204s and bodiless responses resolve to `undefined`.
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
        error instanceof Error ? error.message : "Network request failed",
        "NETWORK_ERROR",
      );
    }

    const status = error.response.status;
    if (status === 401 && !skipAuth) handleUnauthorized();

    // ky has already read the body into `data`; a non-JSON body (a gateway
    // error page, say) arrives as text and is ignored.
    const envelope =
      typeof error.data === "object" && error.data !== null
        ? (error.data as ApiEnvelope<never>)
        : null;

    throw new HermesError(
      envelope?.error?.message ?? error.message,
      envelope?.error?.code ?? "HTTP_ERROR",
      status,
    );
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

interface CallOptions {
  /** Anonymous player calls: never attach the organiser token. */
  skipAuth?: boolean;
  headers?: Record<string, string>;
}

export const api = {
  get: <T>(path: string, opts?: CallOptions) =>
    request<T>(
      () =>
        client.get(path, {
          headers: opts?.headers,
          context: { skipAuth: opts?.skipAuth ?? false },
        }),
      { skipAuth: opts?.skipAuth },
    ),

  post: <T>(path: string, body?: unknown, opts?: CallOptions) =>
    request<T>(
      () =>
        client.post(path, {
          json: body,
          context: { skipAuth: opts?.skipAuth ?? false },
        }),
      { expectNoBody: body === undefined, skipAuth: opts?.skipAuth },
    ),

  put: <T>(path: string, body?: unknown) =>
    request<T>(() => client.put(path, { json: body })),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(() => client.patch(path, { json: body })),

  delete: (path: string) =>
    request<void>(() => client.delete(path), { expectNoBody: true }),
};
