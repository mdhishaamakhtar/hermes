import type { Metadata } from "next";
import { EventClient } from "@/features/events/EventClient";

export const metadata: Metadata = {
  title: "Event",
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventClient eventId={id} />;
}
