"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { describeError, errorStatus } from "@/lib/api";

/**
 * What a page shows when its data will not load. A missing or forbidden
 * resource is final and says so; anything else is probably temporary and
 * offers a retry.
 */
export function LoadError({
  error,
  resource,
  back,
  onRetry,
}: {
  error: unknown;
  /** Singular noun for the thing that failed: "event", "quiz". */
  resource: string;
  back: { href: string; label: string };
  onRetry: () => void;
}) {
  const status = errorStatus(error);
  const backLink = (
    <ButtonLink href={back.href} icon="arrow-left">
      {back.label}
    </ButtonLink>
  );

  if (status === 404) {
    return (
      <StatusScreen
        code="404"
        status="Off air"
        title={`This ${resource} doesn't exist`}
        description="It may have been deleted, or the link is out of date."
        actions={backLink}
      />
    );
  }

  if (status === 403) {
    return (
      <StatusScreen
        code="403"
        status="Off air"
        title={`This ${resource} isn't yours`}
        description="It belongs to another organiser's account. Sign in as that organiser to open it."
        actions={backLink}
      />
    );
  }

  return (
    <StatusScreen
      status="Signal lost"
      statusTone="warning"
      title={`Couldn't load this ${resource}`}
      description={describeError(error, "Something went wrong.")}
      actions={
        <>
          <Button variant="primary" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
          <ButtonLink href={back.href} variant="ghost">
            {back.label}
          </ButtonLink>
        </>
      }
    />
  );
}
