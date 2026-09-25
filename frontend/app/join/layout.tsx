import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join a session",
  description:
    "Join a live Hermes quiz with the six-character code on the host's screen. No account needed.",
};

export default function JoinLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
