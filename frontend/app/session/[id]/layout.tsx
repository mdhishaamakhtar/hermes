import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live session",
  robots: { index: false, follow: false },
};

export default function SessionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
