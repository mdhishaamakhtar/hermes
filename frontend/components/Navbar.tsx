"use client";

import Link from "next/link";
import useSWR from "swr";
import { clearStoredAuthToken } from "@/lib/auth-storage";
import Logo from "./Logo";

export default function Navbar() {
  const { data: user } = useSWR<{ displayName: string }>("/api/auth/me");

  const handleLogout = () => {
    clearStoredAuthToken();
    // Full page load: drops the SWR cache so the next account on this
    // browser can't see the previous user's cached data.
    window.location.assign("/");
  };

  return (
    <nav
      aria-label="Main navigation"
      className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-[var(--z-sticky)]"
    >
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/dashboard"
          prefetch
          aria-label="Hermes — dashboard"
          className="flex items-center -my-2 py-2"
        >
          <Logo size="sm" showWordmark />
        </Link>
        <div className="flex items-center gap-6">
          {user?.displayName && (
            <>
              <span className="text-sm text-muted tracking-wide select-none">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                // -my-3 py-3 lifts the tap target to 40px inside the 56px bar
                // without changing where the text sits. The bare label was
                // 16px tall — under the 24px minimum.
                className="label -my-3 py-3 hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
