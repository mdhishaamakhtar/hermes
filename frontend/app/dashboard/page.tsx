import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import DashboardClient from "@/components/dashboard/DashboardClient";

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

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardClient />
    </div>
  );
}
