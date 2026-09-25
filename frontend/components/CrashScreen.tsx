"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/ui/StatusScreen";

/**
 * The fallback for an uncaught render error, shared by every error boundary.
 * `digest` matches the server log entry, so it is worth showing to anyone
 * who reports the problem.
 */
export function CrashScreen({
  digest,
  onRetry,
}: {
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <StatusScreen
      code="500"
      status="Signal lost"
      statusTone="warning"
      title="Something broke on our end"
      description="Hermes hit an unexpected error while showing this screen. Anything you already saved is safe. Try again, and if it keeps happening, reload the page."
      actions={
        <>
          <Button variant="primary" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
          <ButtonLink href="/" variant="ghost">
            Back to Hermes
          </ButtonLink>
        </>
      }
    >
      {digest && (
        <p className="mt-12 font-mono text-xs text-subtle">
          Reference {digest}
        </p>
      )}
    </StatusScreen>
  );
}
