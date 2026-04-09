"use client";

import Link from "next/link";
import useSWR from "swr";
import { clearStoredAuthToken } from "@/lib/auth-storage";
import Logo from "./Logo";

export default function Navbar() {
  const { data: user } = useSWR<{ displayName: string }>("/api/auth/me");

  const handleLogout = () => {
    clearStoredAuthToken();
  };

  return (
    <nav
      aria-label="Main navigation"
      className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" prefetch aria-label="Hermes — dashboard">
          <Logo size="sm" showWordmark />
        </Link>
        <div className="flex items-center gap-6">
          {user?.displayName && (
            <>
              <span className="text-sm text-muted tracking-wide select-none">
                {user.displayName}
              </span>
              <Link
                href="/"
                prefetch
                onClick={handleLogout}
                className="label hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Sign Out
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
