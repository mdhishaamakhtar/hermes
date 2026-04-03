import { redirect } from "next/navigation";
import QuizEditorClient from "@/components/quizzes/QuizEditorClient";
import { serverApi } from "@/lib/server-api";

interface Option {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
}
interface Question {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: Option[];
}
interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  questions: Question[];
}
interface SessionItem {
  id: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>;
}) {
  const { id, qid } = await params;
  const [quizRes, sessionsRes] = await Promise.all([
    serverApi<Quiz>(`/api/quizzes/${qid}`),
    serverApi<SessionItem[]>(`/api/quizzes/${qid}/sessions`),
  ]);

  if (!quizRes.success) {
    redirect(`/events/${id}`);
  }

  return (
    <QuizEditorClient
      eventId={id}
      quizId={qid}
      initialQuiz={quizRes.data}
      initialSessions={sessionsRes.success ? sessionsRes.data : []}
    />
  );
}
