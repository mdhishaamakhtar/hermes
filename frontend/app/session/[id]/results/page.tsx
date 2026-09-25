import type { Metadata } from "next";
import { ResultsClient } from "@/features/session/results/ResultsClient";

export const metadata: Metadata = {
  title: "Your results",
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsClient sessionId={id} />;
}
