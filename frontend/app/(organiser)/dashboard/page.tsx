import type { Metadata } from "next";
import { DashboardClient } from "@/features/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Events",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
