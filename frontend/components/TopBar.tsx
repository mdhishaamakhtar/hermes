import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

const WIDTHS = {
  /** Organiser and public pages. */
  page: "max-w-5xl",
  /** Live session screens, which need the room. */
  stage: "max-w-7xl",
} as const;

/**
 * The one header every screen shares: the mark on the left, the context's
 * controls on the right. Pass `home={null}` where leaving by accident would
 * hurt, such as a live session.
 */
export function TopBar({
  home = "/",
  width = "page",
  children,
}: {
  home?: string | null;
  width?: keyof typeof WIDTHS;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/85 backdrop-blur-md">
      <div
        className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6 ${WIDTHS[width]}`}
      >
        {home ? (
          <Link
            href={home}
            aria-label="Hermes home"
            className="-m-2 p-2 transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>
        ) : (
          <Logo />
        )}
        {children && (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
