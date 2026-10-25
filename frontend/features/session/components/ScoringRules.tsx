import type { ScoringRules as Rules } from "../session-types";

/**
 * The rules of the game, said before it starts, so nobody learns them from
 * a deduction or a tie they lost. Only rules this session actually uses
 * appear.
 */
export function ScoringRules({
  rules,
  audience,
  className = "",
}: {
  rules: Rules;
  /** Players read "you"; the host reads what players will be told. */
  audience: "player" | "host";
  className?: string;
}) {
  const player = audience === "player";
  const lines = [
    player
      ? "Your pick counts when time runs out, locked in or not. Lock in once you're sure."
      : "A pick counts when time runs out, locked in or not.",
    rules.penalties && "Some wrong answers take points away.",
    rules.speedScoring && "Right answers score more the faster they come in.",
    "Level on points? The faster answers rank higher.",
  ].filter((line): line is string => Boolean(line));

  return (
    <section aria-labelledby="scoring-rules" className={className}>
      <h2 id="scoring-rules" className="text-sm font-semibold text-foreground">
        How scoring works
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
        {lines.map((line) => (
          <li key={line} className="flex gap-3">
            <span
              aria-hidden
              className="mt-[0.45rem] size-1.5 shrink-0 bg-accent"
            />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
