import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { countLabel, formatDateTime } from "@/lib/format";
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
                className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-border bg-surface px-5 py-3.5"
              >
                <Badge tone={status.tone} dot={running}>
                  {status.label}
                </Badge>
                <span className="text-sm text-muted">
                  {formatDateTime(session.startedAt) ?? "Not started yet"}
                </span>
                <span className="text-sm text-subtle">
                  {countLabel(session.participantCount, "player", "players")}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {running ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDiscard(session)}
                        className="hover:text-danger"
                      >
                        Discard
                      </Button>
                      <ButtonLink
                        href={`/session/${session.id}/host`}
                        variant="primary"
                        size="sm"
                        trailingIcon="arrow-right"
                      >
                        Open host view
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
