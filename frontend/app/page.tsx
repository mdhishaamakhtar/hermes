import Link from "next/link";
import Logo from "@/components/Logo";

export default function LandingPage() {
  return (
    <main className="scanlines relative min-h-screen bg-background overflow-hidden flex flex-col">
      {/* Radial gradient bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 35% 50%, rgba(37,99,235,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav
        aria-label="Site navigation"
        className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-border/60"
      >
        <Logo size="sm" showWordmark />
        <Link
          href="/auth/login"
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero — asymmetric, left-aligned */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-5xl">
        <div className="mb-8">
          <Logo size="lg" showWordmark={false} />
        </div>

        <h1 className="font-black tracking-widest text-[clamp(3.5rem,10vw,8rem)] uppercase leading-none text-foreground mb-4">
          HERMES
        </h1>

        <p className="text-muted text-lg md:text-xl max-w-md mb-12 leading-relaxed">
          Real-time quiz sessions. Live analytics. Anonymous participants.
        </p>

        <div className="h-px w-24 bg-primary mb-12" />

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/auth/login"
            className="group inline-flex items-center gap-3 bg-primary text-white px-8 py-4 text-sm tracking-widest uppercase font-medium hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}
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
            className="inline-flex items-center gap-3 border border-border text-foreground px-8 py-4 text-sm tracking-widest uppercase font-medium hover:border-primary/50 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Join a Session
          </Link>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="relative z-10 px-8 py-6 border-t border-border/40">
        <p className="label opacity-40">
          Real-time · WebSocket · Anonymous Participants
        </p>
      </div>
    </main>
  );
}
