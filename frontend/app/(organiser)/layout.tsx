import type { Metadata } from "next";
import { OrganiserShell } from "@/components/OrganiserShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OrganiserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganiserShell>{children}</OrganiserShell>;
}
