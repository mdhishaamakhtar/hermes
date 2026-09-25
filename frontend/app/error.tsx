"use client";

import { useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { CrashScreen } from "@/components/CrashScreen";

export default function Error({
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
    <>
      <TopBar />
      <main id="main" className="flex flex-1 flex-col">
        <CrashScreen digest={error.digest} onRetry={retry} />
      </main>
    </>
  );
}
