"use client";

import { useEffect } from "react";
import { CrashScreen } from "@/components/CrashScreen";
import { mono, sans } from "./fonts";
import "./globals.css";

/*
 * Replaces the root layout when the layout itself throws, so it brings its
 * own document, stylesheet, and fonts. Metadata exports are not supported
 * here; React's <title> stands in.
 */
export default function GlobalError({
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <title>Something broke | Hermes</title>
        <main id="main" className="flex flex-1 flex-col">
          <CrashScreen digest={error.digest} onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
