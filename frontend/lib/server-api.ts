import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiResponse } from "@/lib/api";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

interface ServerUser {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export async function serverApi<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<ApiResponse<T>> {
  const token = init?.token ?? (await cookies()).get("hermes_token")?.value;
  const headers = new Headers(init?.headers);

  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${normalizePath(path)}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return { success: true, data: null as T, error: null };
  }

  return (await response.json()) as ApiResponse<T>;
}

export async function requireServerUser(): Promise<{
  token: string;
  user: ServerUser;
}> {
  const token = (await cookies()).get("hermes_token")?.value;
  if (!token) {
    redirect("/auth/login");
  }

  const res = await serverApi<ServerUser>("/api/auth/me", { token });
  if (!res.success) {
    redirect("/auth/login");
  }

  return { token, user: res.data };
}
