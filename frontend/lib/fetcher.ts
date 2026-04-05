import { api } from "@/lib/api";

export async function fetcher<T>(path: string): Promise<T> {
  const res = await api.get<T>(path);
  if (!res.success) throw new Error(res.error?.message ?? "Failed to load");
  return res.data;
}
