"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredAuthToken } from "@/lib/auth-storage";
import { api } from "@/lib/api";
import Logo from "./Logo";

export default function Navbar() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ displayName: string }>("/api/auth/me").then((res) => {
      if (res.success) setDisplayName(res.data.displayName);
    });
  }, []);

  const handleLogout = () => {
    clearStoredAuthToken();
    router.replace("/");
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
          {displayName && (
            <>
              <span className="text-sm text-muted tracking-wide select-none">
                {displayName}
              </span>
              <button
                onClick={handleLogout}
                className="label hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
