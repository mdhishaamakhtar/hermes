"use client";

import { useState } from "react";
import { motion } from "motion/react";
import useSWR from "swr";
import { LoadError } from "@/components/LoadError";
import { TopBar } from "@/components/TopBar";
import { CountUp } from "@/components/ui/AnimatedNumber";
import { ButtonLink } from "@/components/ui/Button";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { useIsClient } from "@/lib/client";
import { countLabel, formatNumber, ordinal } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import { getStoredRejoinToken } from "@/lib/session-storage";
import { MyQuestionBreakdown, ResultGroups } from "../components/Breakdown";
import { sessionsApi } from "../session-api";
import type { MyResults } from "../session-types";

/** A player's own results. Their rejoin token on this device is the key. */
export function ResultsClient({ sessionId }: { sessionId: string }) {
  const isClient = useIsClient();
  return (
    <>
      <TopBar>
        <ButtonLink href="/join" variant="ghost" size="sm">
          Join another session
        </ButtonLink>
      </TopBar>
      {isClient ? <Results sessionId={sessionId} /> : <ResultsSkeleton />}
    </>
  );
}

function Results({ sessionId }: { sessionId: string }) {
  const [token] = useState(() => getStoredRejoinToken(sessionId));
  const {
    data: results,
    error,
    mutate,
  } = useSWR(
    token ? (["my-results", sessionId, token] as const) : null,
    ([, id, rejoinToken]) => sessionsApi.myResults(id, rejoinToken),
  );

  if (!token) {
    return (
      <main id="main" className="flex flex-1 flex-col">
        <StatusScreen
          status="Off air"
          title="No results on this device"
          description="Results are saved to the phone or browser you played on. Open this page there to see how you did."
          actions={
            <ButtonLink
              href="/join"
              variant="primary"
              trailingIcon="arrow-right"
            >
              Join a session
            </ButtonLink>
          }
        />
      </main>
    );
  }

  if (!results) {
    return error ? (
      <main id="main" className="flex flex-1 flex-col">
        <LoadError
          error={error}
          resource="result"
          back={{ href: "/join", label: "Join a session" }}
          onRetry={() => void mutate()}
        />
      </main>
    ) : (
      <ResultsSkeleton />
    );
  }

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 pt-12 pb-24 sm:px-6 sm:pt-16"
    >
      <Verdict results={results} />

      <section aria-labelledby="answers-heading" className="mt-16">
        <h2
          id="answers-heading"
          className="mb-4 text-xl font-semibold text-foreground"
        >
          Your answers
        </h2>
        <ResultGroups
          questions={results.questions}
          getKey={(question) => question.questionId}
          renderQuestion={(question) => (
            <MyQuestionBreakdown question={question} />
          )}
        />
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
        <ButtonLink href="/join" variant="primary" trailingIcon="arrow-right">
          Join another session
        </ButtonLink>
        <ButtonLink href="/" variant="ghost">
          Back to Hermes
        </ButtonLink>
      </div>
    </main>
  );
}

/**
 * The result, said as a sentence rather than a dashboard: where you placed
 * and what you scored, with the numbers set in the data face.
 */
function Verdict({ results }: { results: MyResults }) {
  const won = results.rank === 1 && results.totalParticipants > 1;
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.stage, ease: ease.out }}
    >
      <h1 className="max-w-[24ch] text-[clamp(2rem,5.5vw,3.5rem)] leading-[1.1] font-bold tracking-tight text-foreground">
        {results.displayName},{" "}
        {won ? (
          <>
            you <span className="text-accent">won</span>
          </>
        ) : (
          <>
            you finished{" "}
            <span className="font-mono font-semibold text-accent">
              {ordinal(results.rank)}
            </span>{" "}
            of {formatNumber(results.totalParticipants)}
          </>
        )}{" "}
        with{" "}
        <span className="font-mono font-semibold">
          <CountUp value={results.score} />
        </span>{" "}
        points.
      </h1>
      <p className="mt-5 text-lg text-muted">
        You got {formatNumber(results.correctCount)} of{" "}
        {countLabel(results.totalQuestions, "question", "questions")} right.
      </p>
    </motion.header>
  );
}

function ResultsSkeleton() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 pt-12 pb-24 sm:px-6 sm:pt-16"
    >
      <LoadingRegion label="Loading your results">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-24 w-full max-w-2xl" />
        <Skeleton className="mt-5 h-6 w-64" />
        <Skeleton className="mt-16 h-7 w-36" />
        <div className="mt-4 flex flex-col gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </LoadingRegion>
    </main>
  );
}
