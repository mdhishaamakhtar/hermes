import Link from "next/link";
import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Real-time Quiz Platform",
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: siteConfig.title,
        url: siteConfig.url,
        description: siteConfig.description,
      },
      {
        "@type": "SoftwareApplication",
        name: siteConfig.title,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteConfig.url,
        image: absoluteUrl("/opengraph-image"),
        description: siteConfig.description,
        creator: {
          "@type": "Person",
          name: siteConfig.creator,
        },
      },
      {
        "@type": "Organization",
        name: siteConfig.title,
        url: siteConfig.url,
        logo: absoluteUrl(siteConfig.iconPath),
      },
    ],
  };

  return (
    <main className="relative min-h-screen bg-background overflow-hidden flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Nav */}
      <nav
        aria-label="Site navigation"
        className="page-enter relative z-10 px-8 py-6 flex items-center justify-between border-b border-border/60"
      >
        <Logo size="sm" showWordmark />
        <Link
          href="/auth/login"
          prefetch
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero — asymmetric, left-aligned */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-5xl">
        <div className="page-enter page-enter-delay-1 mb-8">
          <Logo size="lg" showWordmark={false} />
        </div>

        <h1 className="page-enter page-enter-delay-2 font-black tracking-widest text-[clamp(3.5rem,10vw,8rem)] uppercase leading-none text-foreground mb-4">
          HERMES
        </h1>

        <p className="page-enter page-enter-delay-3 text-muted text-lg md:text-xl max-w-md mb-12 leading-relaxed">
          Real-time quiz sessions. Live analytics. Anonymous participants.
        </p>

        <div className="line-reveal line-reveal-delay h-px w-24 bg-primary mb-12 origin-left" />

        <div className="page-enter page-enter-delay-4 flex flex-col sm:flex-row gap-4">
          <Link
            href="/auth/login"
            prefetch
            className="group inline-flex items-center gap-3 bg-primary text-white px-8 py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Host a Quiz
            <span
              aria-hidden
              className="group-hover:translate-x-1 transition-transform"
            >
              →
            </span>
          </Link>
          <Link
            href="/join"
            prefetch
            className="inline-flex items-center gap-3 border border-border text-foreground px-8 py-4 text-sm tracking-widest uppercase font-medium hover:border-primary/50 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Join a Session
          </Link>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="page-enter page-enter-delay-5 relative z-10 px-8 py-6 border-t border-border/40">
        <p className="label opacity-40">
          Real-time · WebSocket · Anonymous Participants
        </p>
      </div>
    </main>
  );
}
