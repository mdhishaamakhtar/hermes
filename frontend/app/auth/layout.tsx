import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";

// No title here: a string title in a layout would stop the root "%s | Hermes"
// template from reaching the pages below, which name themselves.
export const metadata: Metadata = {
  description:
    "Sign in or create a host account to build quizzes and run live Hermes sessions.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopBar>
        <ButtonLink href="/join" variant="ghost" size="sm">
          Join a session
        </ButtonLink>
      </TopBar>
      <main
        id="main"
        className="flex flex-1 justify-center px-4 pt-14 pb-24 sm:items-center sm:pt-8"
      >
        <div className="w-full max-w-sm animate-rise">{children}</div>
      </main>
    </>
  );
}
