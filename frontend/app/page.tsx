"use client";

import { motion } from "framer-motion";
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
            "radial-gradient(ellipse 60% 40% at 35% 50%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <motion.nav
        aria-label="Site navigation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-border/60"
      >
        <Logo size="sm" showWordmark />
        <Link
          href="/auth/login"
          className="label hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Sign In
        </Link>
      </motion.nav>

      {/* Hero — asymmetric, left-aligned */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="mb-8"
        >
          <Logo size="lg" showWordmark={false} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="font-black tracking-widest text-[clamp(3.5rem,10vw,8rem)] uppercase leading-none text-foreground mb-4"
        >
          HERMES
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="text-muted text-lg md:text-xl max-w-md mb-12 leading-relaxed"
        >
          Real-time quiz sessions. Live analytics. Anonymous participants.
        </motion.p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.25, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="h-px w-24 bg-primary mb-12 origin-left"
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/auth/login"
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
            className="inline-flex items-center gap-3 border border-border text-foreground px-8 py-4 text-sm tracking-widest uppercase font-medium hover:border-primary/50 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Join a Session
          </Link>
        </motion.div>
      </div>

      {/* Bottom rule */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.35 }}
        className="relative z-10 px-8 py-6 border-t border-border/40"
      >
        <p className="label opacity-40">
          Real-time · WebSocket · Anonymous Participants
        </p>
      </motion.div>
    </main>
  );
}
