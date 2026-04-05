import Navbar from "@/components/Navbar";
import ReviewClient from "@/components/session/ReviewClient";

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
