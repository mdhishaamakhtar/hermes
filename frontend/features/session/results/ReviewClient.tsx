"use client";

import useSWR from "swr";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { countLabel, formatDateTime } from "@/lib/format";
import { saveFile } from "@/lib/save-file";
import { sessionsApi } from "../session-api";
import type { SessionResults } from "../session-types";
import { LeaderboardSkeleton } from "../components/Leaderboard";
import { WrapUp } from "../components/WrapUp";
import { resultsCsv, resultsFileName } from "./results-model";
import { Insights, PlayersTable } from "./ResultsDetail";
import { RunAgainButton } from "./RunAgain";

/** A finished session, reviewed from the organiser's side at any later time. */
export function ReviewClient({ sessionId }: { sessionId: string }) {
  const {
    data: results,
    error,
    mutate,
  } = useSWR<SessionResults>(`/api/sessions/${sessionId}/results`);

  if (!results) {
    return error ? (
      <Page>
        <LoadError
          error={error}
          resource="session"
          back={{ href: "/dashboard", label: "Back to your quizzes" }}
          onRetry={() => void mutate()}
        />
      </Page>
    ) : (
      <ReviewSkeleton />
    );
  }

  const date = formatDateTime(results.startedAt);

  return (
    <Page>
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Quizzes" },
          {
            href: `/events/${results.eventId}/quizzes/${results.quizId}`,
            label: results.quizTitle,
          },
        ]}
        title="Session review"
        meta={
          <>
            {date && <span>{date}</span>}
            <span>
              {countLabel(results.participantCount, "player", "players")}
            </span>
            <span>
              {countLabel(results.questionsAsked, "question", "questions")}
            </span>
          </>
        }
        actions={
          <>
            <Button
              icon="download"
              onClick={() =>
                saveFile(
                  resultsFileName(results),
                  new Blob([resultsCsv(results)], {
                    type: "text/csv;charset=utf-8",
                  }),
                )
              }
            >
              Export CSV
            </Button>
            <RunAgainButton quizId={results.quizId} />
          </>
        }
      />
      <Insights results={results} />
      <WrapUp
        results={results}
        onCorrectScoring={async (questionId, points) => {
          await sessionsApi.correctScoring(sessionId, questionId, points);
          await mutate();
          toast.success("Scoring updated. Standings recalculated.");
        }}
      />
      <PlayersTable results={results} />
    </Page>
  );
}

export function ReviewSkeleton() {
  return (
    <Page>
      <LoadingRegion label="Loading session review">
        <PageHeaderSkeleton crumbs titleWidth="w-60" />
        <div className="grid gap-10 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div>
            <Skeleton className="mb-4 h-7 w-40" />
            <LeaderboardSkeleton />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </LoadingRegion>
    </Page>
  );
}
