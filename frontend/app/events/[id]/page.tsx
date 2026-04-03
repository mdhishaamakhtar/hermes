import { redirect } from "next/navigation";
import EventClient from "@/components/events/EventClient";
import { serverApi } from "@/lib/server-api";

interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
}

interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: Quiz[];
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventRes = await serverApi<Event>(`/api/events/${id}`);

  if (!eventRes.success) {
    redirect("/dashboard");
  }

  return <EventClient eventId={id} initialEvent={eventRes.data} />;
}
