import axios, { AxiosError } from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("hermes_token");
  }
  return authToken;
}

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (!config.skipAuth) {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.status === 204) {
      return { ...response, data: { success: true, data: null, error: null } };
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hermes_token");
        window.dispatchEvent(new Event("unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

async function requestWrapper<T>(
  requestFn: () => Promise<{ data: ApiResponse<T> }>,
): Promise<ApiResponse<T>> {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ApiResponse<T>;
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

export const api = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    requestWrapper<T>(() => axiosInstance.get(path, { headers: extraHeaders })),

  post: <T>(path: string, body?: unknown, opts?: { skipAuth?: boolean }) =>
    requestWrapper<T>(() =>
      axiosInstance.post(path, body, { skipAuth: opts?.skipAuth }),
    ),

  put: <T>(path: string, body?: unknown) =>
    requestWrapper<T>(() => axiosInstance.put(path, body)),

  delete: <T>(path: string) =>
    requestWrapper<T>(() => axiosInstance.delete(path)),
};
