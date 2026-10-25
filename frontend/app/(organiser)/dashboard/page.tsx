import type { Metadata } from "next";
import { DashboardClient } from "@/features/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Quizzes",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
