"use client";

import { Icon } from "@/components/ui/Icon";
import { formatNumber, percent } from "@/lib/format";
import { byOrderIndex, optionLetter } from "@/lib/options";
import type {
  PlayerAnswer,
  QuestionResult,
  SessionResults,
} from "../session-types";
import { commonWrongAnswer, hardestQuestion } from "./results-model";

/**
 * What stood out, in two cards built the same way: what it was, the
 * question it was on, and the share of the room behind it.
 */
export function Insights({ results }: { results: SessionResults }) {
  const hardest = hardestQuestion(results);
  const wrong = commonWrongAnswer(results);
  if (!hardest && !wrong) return null;

  return (
    <section
      aria-label="What stood out"
      className="mb-12 grid gap-3 md:grid-cols-2"
    >
      {hardest && (
        <InsightCard
          label="Hardest question"
          number={hardest.question.orderIndex}
          statement={hardest.question.text}
          count={hardest.right}
          of={hardest.answered}
          verb="got it right"
        />
      )}
      {wrong && (
        <InsightCard
          label="Most-picked wrong answer"
          number={wrong.question.orderIndex}
          statement={`${wrong.letter}: ${wrong.option.text}`}
          count={wrong.option.count}
          of={wrong.question.totalAnswers}
          verb="picked it"
        />
      )}
    </section>
  );
}

function InsightCard({
  label,
  number,
  statement,
  count,
  of,
  verb,
}: {
  label: string;
  number: number;
  statement: string;
  count: number;
  of: number;
  verb: string;
}) {
  return (
    <article className="flex flex-col border border-border bg-surface p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 line-clamp-2 text-base font-semibold text-foreground">
        <span className="mr-2 font-mono font-medium text-subtle">
          Q{number}
        </span>
        {statement}
      </p>
      <p className="mt-auto pt-3 text-sm text-muted">
        <span className="font-mono text-foreground">{formatNumber(count)}</span>{" "}
        of {formatNumber(of)} {verb} ·{" "}
        <span className="font-mono">{percent(count, of)}%</span>
      </p>
    </article>
  );
}

/**
 * Every player, question by question: a mark per answer, so a teacher can
 * see at a glance who struggled where. The export carries the detail.
 */
export function PlayersTable({ results }: { results: SessionResults }) {
  const asked = results.questions.filter((question) => question.asked);
  if (results.players.length === 0) return null;

  return (
    <section aria-labelledby="players-heading" className="mt-16">
      <h2
        id="players-heading"
        className="mb-1 text-xl font-semibold text-foreground"
      >
        Players
      </h2>
      <p className="mb-4 text-sm text-subtle">
        Each player&apos;s answers, question by question. Export the session for
        their picks and points.
      </p>
      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-subtle">
              <th scope="col" className="w-14 px-4 py-3 font-medium">
                Rank
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Player
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Score
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Right
              </th>
              {asked.map((question) => (
                <th
                  key={question.id}
                  scope="col"
                  className="w-12 px-1 py-3 text-center font-mono text-xs font-medium"
                >
                  Q{question.orderIndex}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.players.map((player) => (
              <tr
                key={player.participantId}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-4 py-3 font-mono text-subtle tabular-nums">
                  {player.rank}
                </td>
                <td className="max-w-48 truncate px-4 py-3 text-foreground">
                  {player.displayName}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground tabular-nums">
                  {formatNumber(player.score)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted tabular-nums">
                  {player.correctCount}
                </td>
                {asked.map((question) => (
                  <td key={question.id} className="px-1 py-3 text-center">
                    <AnswerMark
                      question={question}
                      answer={player.answers.find(
                        (answer) => answer.questionId === question.id,
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One answer as a mark: right, part right, wrong, a vote, or none. */
function AnswerMark({
  question,
  answer,
}: {
  question: QuestionResult;
  answer?: PlayerAnswer;
}) {
  const picked = answer?.selectedOptionIds ?? [];
  if (picked.length === 0) {
    return (
      <span
        className="text-subtle"
        title={`Q${question.orderIndex}: no answer`}
      >
        <span aria-hidden>–</span>
        <span className="sr-only">No answer</span>
      </span>
    );
  }
  const letters = byOrderIndex(question.options)
    .map((option, index) =>
      picked.includes(option.id) ? optionLetter(index) : null,
    )
    .filter(Boolean)
    .join(" ");
  const title = `Q${question.orderIndex}: picked ${letters}${
    question.poll ? "" : `, ${answer?.score ?? 0} pts`
  }`;

  if (question.poll) {
    return (
      <span className="font-mono text-xs text-accent" title={title}>
        {letters}
      </span>
    );
  }
  const mark = answer?.correct
    ? { icon: "check" as const, tone: "text-success", label: "Right" }
    : (answer?.score ?? 0) > 0
      ? { icon: "check" as const, tone: "text-warning", label: "Partly right" }
      : { icon: "close" as const, tone: "text-danger", label: "Wrong" };
  return (
    <span className={`inline-flex ${mark.tone}`} title={title}>
      <Icon name={mark.icon} size={14} />
      <span className="sr-only">{mark.label}</span>
    </span>
  );
}
