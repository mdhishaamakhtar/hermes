import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import ReviewClient from "@/components/session/ReviewClient";
import { requireServerUser, serverApi } from "@/lib/server-api";

interface OptionResult {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  count: number;
}

interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: OptionResult[];
  totalAnswers: number;
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
}

interface SessionResults {
  sessionId: number;
  quizId: number;
  eventId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  participantCount: number;
  leaderboard: LeaderboardEntry[];
  questions: QuestionResult[];
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireServerUser();
  const resultsRes = await serverApi<SessionResults>(
    `/api/sessions/${id}/results`,
  );

  if (!resultsRes.success) {
    redirect("/dashboard");
  }

  return (
    <div className="scanlines min-h-screen bg-background">
      <Navbar displayName={user.displayName} />
      <ReviewClient initialResults={resultsRes.data} />
    </div>
  );
}
