import Link from "next/link";
import Logo from "./Logo";

/**
 * Minimal top nav used on public/participant pages (auth, join, results).
 * Shows only the Logo linked to home — no user controls.
 */
export default function MinimalNav() {
  return (
    <nav className="px-8 py-6 border-b border-border" aria-label="Site navigation">
      <Link href="/" aria-label="Hermes — home">
        <Logo size="sm" />
      </Link>
    </nav>
  );
}
