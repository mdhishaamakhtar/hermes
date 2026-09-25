import type { Metadata } from "next";
import { QuizEditorClient } from "@/features/quizzes/QuizEditorClient";

export const metadata: Metadata = {
  title: "Quiz editor",
};

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>;
}) {
  const { id, qid } = await params;
  return <QuizEditorClient eventId={id} quizId={qid} />;
}
