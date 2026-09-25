"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { SWRConfig, type SWRConfiguration } from "swr";
import { Toaster } from "@/components/ui/Toast";
import { api, errorStatus } from "@/lib/api";

// Retrying cannot fix a missing login, a forbidden resource, or one that does
// not exist. Everything else gets a few backed-off retries rather than SWR's
// default of retrying forever, which left pages silently stuck.
const FINAL_STATUSES = new Set([401, 403, 404]);
const MAX_RETRIES = 3;

const onErrorRetry: SWRConfiguration["onErrorRetry"] = (
  error,
  _key,
  _config,
  revalidate,
  { retryCount },
) => {
  const status = errorStatus(error);
  if (status !== undefined && FINAL_STATUSES.has(status)) return;
  if (retryCount >= MAX_RETRIES) return;
  setTimeout(() => revalidate({ retryCount }), 1000 * 2 ** retryCount);
};

const swrConfig: SWRConfiguration = {
  fetcher: (path: string) => api.get(path),
  keepPreviousData: true,
  revalidateOnFocus: false,
  onErrorRetry,
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    </SWRConfig>
  );
}
