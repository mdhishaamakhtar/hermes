import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { requireServerUser } from "@/lib/server-api";

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

export default async function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireServerUser();

  return (
    <div className="min-h-screen bg-background">
      <Navbar displayName={user.displayName} />
      {children}
    </div>
  );
}
