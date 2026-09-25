import type { Metadata } from "next";
import { ReviewClient } from "@/features/session/results/ReviewClient";

export const metadata: Metadata = {
  title: "Session review",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewClient sessionId={id} />;
}
