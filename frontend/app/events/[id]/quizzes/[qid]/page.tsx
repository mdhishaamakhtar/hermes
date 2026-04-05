import QuizEditorClient from "@/components/quizzes/QuizEditorClient";

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>;
}) {
  const { id, qid } = await params;
  return <QuizEditorClient eventId={id} quizId={qid} />;
}
