"use client";

import useSWR from "swr";
import { LoadError } from "@/components/LoadError";
import { Page, PageHeader, PageHeaderSkeleton } from "@/components/Page";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { countLabel, formatDate } from "@/lib/format";
import { sessionsApi } from "../session-api";
import type { SessionResults } from "../session-types";
import { LeaderboardSkeleton } from "../components/Leaderboard";
import { WrapUp } from "../components/WrapUp";

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
          back={{ href: "/dashboard", label: "Back to your events" }}
          onRetry={() => void mutate()}
        />
      </Page>
    ) : (
      <ReviewSkeleton />
    );
  }

  const date = formatDate(results.startedAt);

  return (
    <Page>
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Events" },
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
              {countLabel(results.questions.length, "question", "questions")}
            </span>
          </>
        }
      />
      <WrapUp
        results={results}
        onCorrectScoring={async (questionId, points) => {
          await sessionsApi.correctScoring(sessionId, questionId, points);
          await mutate();
          toast.success("Scoring updated. Standings recalculated.");
        }}
      />
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
