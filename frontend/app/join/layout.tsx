import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join a Session",
  description:
    "Join a live Hermes quiz session with a six-character code and rejoin active sessions instantly.",
};

export default function JoinLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
