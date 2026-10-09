import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { countNoun, formatDateTime, formatNumber } from "@/lib/format";
import type { SessionStatus, SessionSummary } from "@/lib/types";

const STATUS: Record<
  SessionStatus,
  { label: string; tone: "live" | "warning" | "neutral" }
> = {
  LOBBY: { label: "Lobby open", tone: "warning" },
  ACTIVE: { label: "Live", tone: "live" },
  ENDED: { label: "Ended", tone: "neutral" },
};

/** Every run of this quiz, newest first. */
export function SessionList({
  sessions,
  onDiscard,
}: {
  sessions: SessionSummary[];
  onDiscard: (session: SessionSummary) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="sessions-heading" className="mt-16">
      <h2
        id="sessions-heading"
        className="mb-4 text-xl font-semibold text-foreground"
      >
        Sessions
      </h2>
      <ul className="flex flex-col gap-2">
        {sessions
          .toSorted((a, b) => b.id - a.id)
          .map((session) => {
            const status = STATUS[session.status];
            const running = session.status !== "ENDED";
            return (
              <li
                key={session.id}
                className="flex items-center gap-4 border border-border bg-surface px-4 py-3 sm:px-5"
              >
                {/* Stacked on a phone, so the actions keep their place on
                    the right instead of wrapping onto a line of their own. */}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                  <Badge tone={status.tone} dot={running}>
                    {status.label}
                  </Badge>
                  <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <span>
                      {formatDateTime(session.startedAt) ?? "Not started yet"}
                    </span>
                    {/* On a phone the count is a figure by a person, as in
                        the session header; the noun stays for screen readers. */}
                    <span className="flex items-center gap-1.5 text-subtle">
                      <Icon name="user" size={13} className="sm:hidden" />
                      <span>
                        {formatNumber(session.participantCount)}{" "}
                        <span className="max-sm:sr-only">
                          {countNoun(
                            session.participantCount,
                            "player",
                            "players",
                          )}
                        </span>
                      </span>
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  {running ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="trash"
                        onClick={() => onDiscard(session)}
                        className="hover:text-danger"
                      >
                        <span className="max-sm:sr-only">Discard</span>
                      </Button>
                      <ButtonLink
                        href={`/session/${session.id}/host`}
                        variant="primary"
                        size="sm"
                        trailingIcon="arrow-right"
                      >
                        <span className="max-sm:sr-only">Open host view</span>
                        <span aria-hidden className="sm:hidden">
                          Open
                        </span>
                      </ButtonLink>
                    </>
                  ) : (
                    <ButtonLink
                      href={`/session/${session.id}/review`}
                      size="sm"
                      trailingIcon="arrow-right"
                    >
                      Review
                    </ButtonLink>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
