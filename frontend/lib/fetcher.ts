import { api } from "@/lib/api";
import type { MyResults } from "@/lib/types";

export async function fetcher<T>(path: string): Promise<T> {
  const res = await api.get<T>(path);
  if (!res.success) throw new Error(res.error?.message ?? "Failed to load");
  return res.data;
}

export async function fetchMyResults(
  sessionId: string,
  rejoinToken: string,
): Promise<MyResults> {
  const res = await api.get<MyResults>(
    `/api/sessions/${sessionId}/my-results`,
    {
      "X-Rejoin-Token": rejoinToken,
    },
  );
  if (!res.success) throw new Error(res.error?.message ?? "Failed to load");
  return res.data;
}
