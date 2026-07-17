import ky, { HTTPError, type Options } from "ky";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/auth-storage";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; status?: number } | null;
}

export function getAuthToken(): string | null {
  return getStoredAuthToken();
}

interface RequestOptions extends Options {
  skipAuth?: boolean;
}

const kyInstance = ky.create({
  prefixUrl: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request, options: RequestOptions) => {
        if (!options.skipAuth) {
          const token = getAuthToken();
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        }
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

async function requestWrapper<T>(
  requestFn: () => Promise<Response>,
  {
    is204 = false,
    skipAuth = false,
  }: { is204?: boolean; skipAuth?: boolean } = {},
): Promise<ApiResponse<T>> {
  try {
    const response = await requestFn();
    if (is204 || response.status === 204) {
      return { success: true, data: null as unknown as T, error: null };
    }
    const data = (await response.json()) as ApiResponse<T>;
    return data;
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      if (status === 401 && !skipAuth) {
        handleUnauthorized();
      }
      try {
        const data = (await error.response.json()) as ApiResponse<T>;
        if (data.error) data.error.status = status;
        return data;
      } catch {
        return {
          success: false,
          data: null as unknown as T,
          error: { code: "HTTP_ERROR", message: error.message, status },
        };
      }
    }
    return {
      success: false,
      data: null as unknown as T,
      error: {
        code: "UNKNOWN_ERROR",
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
    };
  }
}

// ky's prefixUrl requires no leading slash
function normalizePath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

export const api = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    requestWrapper<T>(() =>
      kyInstance.get(normalizePath(path), {
        headers: extraHeaders,
      }),
    ),

  post: <T>(path: string, body?: unknown, opts?: { skipAuth?: boolean }) =>
    requestWrapper<T>(
      () =>
        kyInstance.post(normalizePath(path), {
          json: body,
          skipAuth: opts?.skipAuth,
        } as RequestOptions),
      { is204: !body, skipAuth: opts?.skipAuth },
    ),

  put: <T>(path: string, body?: unknown) =>
    requestWrapper<T>(() =>
      kyInstance.put(normalizePath(path), {
        json: body,
      }),
    ),

  patch: <T>(path: string, body?: unknown) =>
    requestWrapper<T>(() =>
      kyInstance.patch(normalizePath(path), {
        json: body,
      }),
    ),

  delete: <T>(path: string) =>
    requestWrapper<T>(() => kyInstance.delete(normalizePath(path)), {
      is204: true,
    }),
};
