import type { Metadata } from "next";

export const metadata: Metadata = {
  // A template, not a string, so child titles keep the " | Hermes" suffix.
  title: { default: "Live session", template: "%s | Hermes" },
  robots: { index: false, follow: false },
};

export default function SessionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
