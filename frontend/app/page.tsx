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
          <div className="animate-rise">
            <h1 className="display display-tight max-w-[13ch] text-[clamp(3.25rem,7vw,7rem)] leading-[0.86] tracking-[-0.025em] text-foreground">
              Live quizzes, run like a broadcast.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg text-muted sm:text-xl sm:leading-relaxed">
              Put a question on the big screen and watch the room answer in real
              time. Players join from any phone with a six-character code. No
              accounts, no app.
            </p>
            <div className="mt-10">
              <ButtonLink
                href="/auth/register"
                variant="primary"
                size="lg"
                trailingIcon="arrow-right"
              >
                Host a quiz
              </ButtonLink>
            </div>
            <div className="mt-12 max-w-md border-t border-border pt-8">
              <CodeEntry />
            </div>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <DemoRound />
            <p className="mt-3 text-sm text-subtle">
              A sample round, playing on repeat.
            </p>
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
