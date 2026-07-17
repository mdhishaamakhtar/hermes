import { api } from "@/lib/api";
import type { MyResults } from "@/lib/types";

/** Error thrown by SWR fetchers; carries the HTTP status so retry logic can skip auth/not-found failures. */
export class FetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

export async function fetcher<T>(path: string): Promise<T> {
  const res = await api.get<T>(path);
  if (!res.success) {
    throw new FetchError(
      res.error?.message ?? "Failed to load",
      res.error?.status,
    );
  }
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
  if (!res.success) {
    throw new FetchError(
      res.error?.message ?? "Failed to load",
      res.error?.status,
    );
  }
  return res.data;
}
