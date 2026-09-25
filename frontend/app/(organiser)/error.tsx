"use client";

import { useEffect } from "react";
import { CrashScreen } from "@/components/CrashScreen";

/** Renders inside the organiser shell, so the account bar stays usable. */
export default function OrganiserError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <CrashScreen digest={error.digest} onRetry={retry} />
    </main>
  );
}
