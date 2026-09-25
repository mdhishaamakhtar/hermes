import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * A whole screen given over to one state: a 404, a crash, a session that no
 * longer exists. The stage goes dark; one status light and a plain sentence
 * say what happened, and the actions say where to go next.
 */
export function StatusScreen({
  code,
  status,
  statusTone = "neutral",
  title,
  description,
  actions,
  children,
}: {
  /** A short machine code, drawn large and dim: "404", "500". */
  code?: string;
  /** The status light's label: "Off air", "Signal lost". */
  status?: string;
  statusTone?: BadgeTone;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-2xl animate-rise flex-col items-start px-4 py-16 sm:px-6 sm:py-24">
      {status && (
        <Badge tone={statusTone} dot>
          {status}
        </Badge>
      )}
      {code && (
        <p
          aria-hidden
          className="mt-8 font-mono text-[clamp(4.5rem,16vw,8.5rem)] leading-[0.85] font-medium tracking-tighter text-border-strong select-none"
        >
          {code}
        </p>
      )}
      <h1 className="mt-8 text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description && (
        <div className="mt-3 max-w-xl text-base text-muted">{description}</div>
      )}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      {children}
    </section>
  );
}
