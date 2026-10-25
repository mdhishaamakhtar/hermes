import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { CodeEntry } from "@/features/landing/CodeEntry";
import { DemoRound } from "@/features/landing/DemoRound";
import { absoluteUrl, siteConfig } from "@/lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
    },
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteConfig.url,
      image: absoluteUrl("/opengraph-image"),
      description: siteConfig.description,
      creator: { "@type": "Person", name: siteConfig.creator },
    },
  ],
};

const SECTION = "mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28";
const HEADING =
  "display display-tight max-w-[18ch] text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95] text-foreground";

const STEPS = [
  {
    title: "Write it",
    body: "Questions with one right answer or several, reading passages, and polls with none. Or start from the sample quiz.",
  },
  {
    title: "Run it live",
    body: "Put the big screen on the projector and the room joins with the code. You run the show from the controller, your phone, or a clicker.",
  },
  {
    title: "Read the room",
    body: "Standings between questions, a podium to finish, and every answer afterwards, ready to export.",
  },
];

const ROOMS = [
  {
    title: "Classrooms",
    body: "Check understanding mid-lesson without anyone signing up. Afterwards, see who struggled where, question by question, and export it.",
  },
  {
    title: "Trivia nights",
    body: "Run each round as its own quiz in one event, and the standings add up across the night. Turn on speed scoring and quick answers count for more.",
  },
  {
    title: "Talks and meetings",
    body: "Ask a poll with no right answer and the big screen shows how the room split, live, as the votes come in.",
  },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TopBar width="stage">
        {/* On a phone the code field is right below; the header keeps one
            action so it never runs past the screen edge. */}
        <ButtonLink
          href="/join"
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
        >
          Join a session
        </ButtonLink>
        <ButtonLink href="/auth/login" size="sm">
          Sign in
        </ButtonLink>
      </TopBar>

      <main id="main" className="flex-1">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:gap-20 lg:pt-24 lg:pb-28">
          {/* On a phone the visitor is most likely a player with a code in
              hand, so the code field comes straight after the headline; on a
              wider screen it follows the pitch. */}
          <div className="flex animate-rise flex-col">
            <h1 className="display display-tight max-w-[13ch] text-[clamp(3.25rem,7vw,7rem)] leading-[0.86] tracking-[-0.025em] text-foreground">
              Live quizzes, run like a broadcast.
            </h1>
            <div className="mt-8 max-w-md sm:order-last sm:mt-12 sm:border-t sm:border-border sm:pt-8">
              <CodeEntry />
            </div>
            <p className="mt-10 max-w-[34rem] text-lg text-muted max-sm:border-t max-sm:border-border max-sm:pt-8 sm:mt-6 sm:text-xl sm:leading-relaxed">
              Put a question on the big screen and watch the room answer in real
              time. Players join from any phone with a six-character code. No
              accounts, no app.
            </p>
            <div className="mt-8 sm:mt-10">
              <ButtonLink
                href="/auth/register"
                variant="primary"
                size="lg"
                trailingIcon="arrow-right"
              >
                Host a quiz
              </ButtonLink>
            </div>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <DemoRound />
            <p className="mt-3 text-sm text-subtle">
              A sample round, playing on repeat.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="how-heading"
          className="border-t border-border"
        >
          <div className={SECTION}>
            <h2 id="how-heading" className={HEADING}>
              From a blank page to the final standings.
            </h2>
            <ol className="mt-12 grid gap-px border border-border bg-border md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="bg-background p-6 sm:p-8">
                  <p className="font-mono text-sm text-accent tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-8 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="rooms-heading"
          className="border-t border-border"
        >
          <div className={SECTION}>
            <h2 id="rooms-heading" className={HEADING}>
              Made for the room you&apos;re in.
            </h2>
            <dl className="mt-12 border-t border-border">
              {ROOMS.map((room) => (
                <div
                  key={room.title}
                  className="grid gap-2 border-b border-border py-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-baseline md:gap-10 md:py-8"
                >
                  <dt className="display text-2xl text-foreground">
                    {room.title}
                  </dt>
                  <dd className="max-w-[60ch] text-muted">{room.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
              <ButtonLink
                href="/auth/register"
                variant="primary"
                size="lg"
                trailingIcon="arrow-right"
              >
                Host a quiz
              </ButtonLink>
              <p className="text-muted">Your players never need an account.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 text-sm text-subtle sm:px-6">
          <span className="flex items-center gap-2.5">
            <LogoMark size={16} />
            Hermes
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/join"
              className="transition-colors hover:text-foreground"
            >
              Join a session
            </Link>
            <Link
              href="/auth/register"
              className="transition-colors hover:text-foreground"
            >
              Create a host account
            </Link>
            <Link
              href="/auth/login"
              className="transition-colors hover:text-foreground"
            >
              Host sign in
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
