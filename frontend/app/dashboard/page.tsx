import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { requireServerUser, serverApi } from "@/lib/server-api";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: { id: number; title: string; orderIndex: number }[];
}

export default async function DashboardPage() {
  const { user } = await requireServerUser();
  const eventsRes = await serverApi<Event[]>("/api/events");
  const events = eventsRes.success ? eventsRes.data : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar displayName={user.displayName} />
      <DashboardClient initialEvents={events} />
    </div>
  );
}
