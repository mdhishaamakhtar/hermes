import { TopBar } from "@/components/TopBar";

/**
 * Shown while a live screen connects. A session could be in its lobby, mid
 * question, or over, so rather than guess at a layout this says what is
 * actually happening.
 */
export function SessionLoading({
  message = "Tuning in to the session…",
}: {
  message?: string;
}) {
  return (
    <>
      <TopBar home={null} width="stage" />
      <main id="main" className="flex flex-1 items-center justify-center px-4">
        <div
          role="status"
          className="flex animate-fade flex-col items-center gap-4 text-center"
        >
          <span className="flex items-center gap-2.5 text-accent">
            <span aria-hidden className="live-dot" />
            <span className="label text-accent">Connecting</span>
          </span>
          <p className="text-lg text-muted">{message}</p>
        </div>
      </main>
    </>
  );
}
