import type { QuestionLifecycle } from "../session-types";

/**
 * The show's running order, as the gallery keeps it: one cell per
 * question. Done segments are filled in, the one on stage carries the
 * tally (lit while its clock runs), and what is still to come waits in
 * outline. The numbering is the information: where the room is in the
 * quiz and how much is left.
 */
export function Rundown({
  total,
  first,
  last,
  lifecycle,
}: {
  total: number;
  /** The question, or first of a passage's questions, on stage. */
  first: number;
  last: number;
  lifecycle: QuestionLifecycle;
}) {
  if (total < 2) return null;
  const live = lifecycle === "TIMED";

  return (
    <section
      aria-label="Rundown"
      className="border border-border bg-surface p-5"
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="label">Rundown</h2>
        <p className="font-mono text-sm text-muted tabular-nums">
          <span className="text-foreground">
            {String(first).padStart(2, "0")}
          </span>
          {" / "}
          {String(total).padStart(2, "0")}
        </p>
      </div>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1">
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1;
          const onStage = number >= first && number <= last;
          const done = number < first;
          return (
            <li
              key={number}
              aria-current={onStage ? "step" : undefined}
              className={`flex h-8 items-center justify-center border font-mono text-xs font-semibold tabular-nums transition-colors duration-(--duration-enter) ${
                onStage
                  ? live
                    ? "border-tally bg-tally text-ink"
                    : "border-tally text-tally"
                  : done
                    ? "border-border bg-border text-subtle"
                    : "border-border text-subtle"
              }`}
            >
              {String(number).padStart(2, "0")}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
