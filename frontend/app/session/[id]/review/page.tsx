import Navbar from "@/components/Navbar";
import ReviewClient from "@/features/session/components/ReviewClient";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ReviewClient sessionId={id} />
    </div>
  );
}
