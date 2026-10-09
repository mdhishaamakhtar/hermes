"use client";

import { useEffect, useEffectEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { onUnauthorized } from "@/lib/api";
import { clearStoredAuthToken, getStoredAuthToken } from "@/lib/auth";

interface Organiser {
  id: number;
  email: string;
  displayName: string;
}

/**
 * Everything behind the organiser login: the account bar, and what happens
 * when the session ends. proxy.ts turns away requests without the cookie;
 * this catches the rest — a token that expires mid-visit, or a page restored
 * from the router cache after signing out.
 */
export function OrganiserShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const { data: organiser } = useSWR<Organiser>("/api/auth/me");

  // Drop every cached response so the next account on this browser starts
  // clean, then navigate.
  const leaveFor = (href: string) => {
    void mutate(() => true, undefined, { revalidate: false });
    router.replace(href);
  };

  const sendToLogin = useEffectEvent(() => {
    leaveFor(`/auth/login?next=${encodeURIComponent(pathname)}`);
  });

  useEffect(() => {
    if (!getStoredAuthToken()) {
      sendToLogin();
      return;
    }
    return onUnauthorized(() => sendToLogin());
  }, []);

  const signOut = () => {
    clearStoredAuthToken();
    leaveFor("/");
  };

  return (
    <>
      <TopBar home="/dashboard">
        {organiser && (
          <span className="hidden max-w-48 truncate text-sm text-muted sm:block">
            {organiser.displayName}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon="sign-out"
          onClick={signOut}
          className="ghost-flush-end"
        >
          Sign out
        </Button>
      </TopBar>
      {children}
    </>
  );
}
