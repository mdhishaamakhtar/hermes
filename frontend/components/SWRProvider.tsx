"use client";

import { SWRConfig, type SWRConfiguration } from "swr";
import { api, HermesError } from "@/lib/api";

// Don't retry requests that will never succeed by retrying: expired/missing
// auth (401 already triggers a redirect to login in lib/api.ts), forbidden,
// and not-found. Everything else gets a few backed-off retries instead of
// SWR's default infinite retry, which left pages silently stuck.
const NO_RETRY_STATUSES = new Set([401, 403, 404]);
const MAX_RETRIES = 3;

const onErrorRetry: SWRConfiguration["onErrorRetry"] = (
  error,
  _key,
  _config,
  revalidate,
  { retryCount },
) => {
  if (
    error instanceof HermesError &&
    error.status !== undefined &&
    NO_RETRY_STATUSES.has(error.status)
  ) {
    return;
  }
  if (retryCount >= MAX_RETRIES) return;
  setTimeout(() => revalidate({ retryCount }), 1000 * 2 ** retryCount);
};

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        fetcher: (path: string) => api.get(path),
        keepPreviousData: true,
        revalidateOnFocus: false,
        onErrorRetry,
      }}
    >
      {children}
    </SWRConfig>
  );
}
