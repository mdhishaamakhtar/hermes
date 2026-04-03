import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organiser Access",
  description:
    "Sign in or create an organiser account to manage events and host live quiz sessions in Hermes.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
