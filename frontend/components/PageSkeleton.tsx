import { LeaderboardRowSkeleton } from "@/components/ui/LeaderboardRow";
import { PageHeaderSkeleton } from "@/components/ui/PageHeader";
import { ResourceRowSkeleton } from "@/components/ui/ResourceRow";
import { Shimmer } from "@/components/ui/Shimmer";

/*
 * Route-level loading states, one per app/**\/loading.tsx.
 *
 * Which skeleton a route shows, and when, is unchanged — only where the
 * geometry comes from. Rows and headers are no longer redrawn here from
 * memory; they are the placeholder twins exported beside the real components
 * (ResourceRow, LeaderboardRow, PageHeader), so restyling one moves the
 * other. Everything below composes those.
 *
 * A skeleton's job is to reserve the exact space the content will occupy. If
 * it is a few pixels short, the page jumps when data lands — that jump is
 * what commits 032341d and cd06232 were chasing.
 */

/** Standard page container: matches the real pages' max width and padding. */
const PAGE = "mx-auto max-w-4xl px-6 py-12";

/** Full-height shell with the sticky nav bar reserved. */
function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background/80">
        <div className="mx-auto h-14 max-w-4xl px-6" />
      </div>
      {children}
    </div>
  );
}

function Divider({ className = "mb-8" }: { className?: string }) {
  return <div className={`h-px bg-border ${className}`} />;
}

function RowStack({ children }: { children: React.ReactNode }) {
  return <div className="list-stack">{children}</div>;
}

export function NavPageSkeleton() {
  return (
    <NavShell>
      <ContentSkeleton />
    </NavShell>
  );
}

export function ContentSkeleton() {
  return (
    <div className={PAGE}>
      <PageHeaderSkeleton titleWidth="w-48" />
      <RowStack>
        {[1, 2, 3].map((i) => (
          <ResourceRowSkeleton key={i} />
        ))}
      </RowStack>
    </div>
  );
}

/** Dashboard: event rows with a subtitle line. */
export function EventListSkeleton() {
  return (
    <div className={PAGE}>
      <PageHeaderSkeleton titleWidth="w-24" action />
      <Divider />
      <RowStack>
        {[1, 2, 3].map((i) => (
          <ResourceRowSkeleton key={i} subtitle />
        ))}
      </RowStack>
    </div>
  );
}

/** Event page: back link, header with description, then quiz rows. */
export function EventDetailSkeleton() {
  return (
    <div className={PAGE}>
      <Shimmer h="h-4" w="w-20" tone="soft" className="mb-2" />
      <PageHeaderSkeleton titleWidth="w-56" labelWidth="w-10" description />
      <div className="mb-6 flex items-center justify-between">
        <Shimmer h="h-4" w="w-14" tone="soft" />
        <Shimmer h="h-9" w="w-24" />
      </div>
      <Divider className="mb-4" />
      <RowStack>
        {[1, 2, 3].map((i) => (
          <ResourceRowSkeleton key={i} leading />
        ))}
      </RowStack>
    </div>
  );
}

/** Quiz editor: header, canvas toolbar, then question cards. */
export function QuizEditorSkeleton() {
  return (
    <div className={PAGE}>
      <Shimmer h="h-4" w="w-14" tone="soft" className="mb-2" />
      <PageHeaderSkeleton titleWidth="w-48" labelWidth="w-20" action />
      <div className="mb-4 flex items-center justify-between">
        <Shimmer h="h-4" w="w-24" tone="soft" />
        <Shimmer h="h-4" w="w-24" tone="soft" />
      </div>
      <Divider className="mb-4" />
      <RowStack>
        {[1, 2, 3].map((i) => (
          <QuestionSkeleton key={i} />
        ))}
      </RowStack>
    </div>
  );
}

/** Review: header, summary panel, tab strip, leaderboard rows. */
export function ReviewSkeleton() {
  return (
    <div className={PAGE}>
      <Shimmer h="h-4" w="w-24" tone="soft" className="mb-2" />
      <PageHeaderSkeleton titleWidth="w-64" labelWidth="w-28" description />

      <div className="mb-8 border border-border bg-surface px-6 py-5">
        <Shimmer h="h-4" w="w-24" tone="soft" on="border" className="mb-2" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Shimmer h="h-8" w="w-64" on="border" />
          <div className="flex gap-3">
            <Shimmer h="h-4" w="w-16" tone="soft" on="border" />
            <Shimmer h="h-4" w="w-20" tone="soft" on="border" />
          </div>
        </div>
      </div>

      <div className="mb-8 flex gap-0 border-b border-border">
        <Shimmer h="h-12" w="w-32" />
        <Shimmer h="h-12" w="w-28" tone="soft" />
      </div>

      <RowStack>
        {[1, 2, 3, 4].map((i) => (
          <LeaderboardRowSkeleton key={i} />
        ))}
      </RowStack>
    </div>
  );
}

export function ReviewPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Shimmer h="h-4" w="w-28" />
          <div className="flex items-center gap-6">
            <Shimmer h="h-4" w="w-32" tone="soft" />
            <Shimmer h="h-4" w="w-16" tone="soft" />
          </div>
        </div>
      </div>
      <ReviewSkeleton />
    </div>
  );
}

/** Session lobby (host and play share this shape). */
export function SessionPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SessionHeaderSkeleton>
        <Shimmer h="h-7" w="w-16" className="border border-border" />
        <div className="flex flex-col items-end gap-1">
          <Shimmer h="h-4" w="w-10" />
          <Shimmer h="h-4" w="w-24" tone="soft" />
        </div>
      </SessionHeaderSkeleton>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full flex-col items-center">
          <Shimmer h="h-4" w="w-44" tone="soft" className="mb-8" />

          <div className="w-full max-w-lg bg-surface px-6 py-8 sm:px-10 sm:py-10">
            <Shimmer
              h="h-4"
              w="w-28"
              tone="soft"
              on="border"
              className="mx-auto mb-5"
            />
            <Shimmer
              h="h-12"
              w="w-full max-w-[20rem]"
              on="border"
              className="mx-auto"
            />
            <Shimmer
              h="h-4"
              w="w-2/3"
              tone="soft"
              on="border"
              className="mx-auto mt-4"
            />
          </div>

          <Shimmer
            h="h-10"
            w="w-32"
            className="mt-5 border border-border bg-background/80"
          />

          <div className="mt-14 w-full max-w-xs border-t border-border pt-10">
            <div className="flex flex-col items-center gap-3">
              <Shimmer h="h-10" w="w-16" />
              <Shimmer h="h-4" w="w-24" tone="soft" />
            </div>
          </div>

          <Shimmer h="h-11" w="w-40" className="mt-12" />
          <Shimmer h="h-4" w="w-20" tone="soft" className="mt-6" />
        </div>
      </main>
    </div>
  );
}

/** Participant results: score card, then per-question breakdowns. */
export function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <SessionHeaderSkeleton>
        <Shimmer h="h-4" w="w-16" tone="soft" />
        <Shimmer h="h-4" w="w-24" tone="soft" />
      </SessionHeaderSkeleton>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Shimmer h="h-4" w="w-24" tone="soft" className="mb-6" />

        <div className="mb-4 border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Shimmer
                h="h-4"
                w="w-16"
                tone="soft"
                on="border"
                className="mb-3"
              />
              <Shimmer h="h-10" w="w-32" on="border" />
              <Shimmer
                h="h-4"
                w="w-12"
                tone="soft"
                on="border"
                className="mt-3"
              />
            </div>
            <div className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:min-w-[18rem]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border border-border bg-background p-4">
                  <Shimmer h="h-8" w="w-16" on="border" className="mx-auto" />
                  <Shimmer
                    h="h-4"
                    w="w-12"
                    tone="soft"
                    on="border"
                    className="mx-auto mt-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border bg-surface p-6">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <Shimmer
                    h="h-4"
                    w="w-28"
                    tone="soft"
                    on="border"
                    className="mb-2"
                  />
                  <Shimmer h="h-6" w="w-56" on="border" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Shimmer h="h-4" w="w-16" tone="soft" on="border" />
                  <Shimmer h="h-4" w="w-14" tone="soft" on="border" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((j) => (
                  <OptionSkeleton key={j} size="lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────────────── */

/** The header strip used by the session, results, and play routes. */
function SessionHeaderSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <header className="border-b border-border px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Shimmer h="h-4" w="w-20" />
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </header>
  );
}

/**
 * One answer option. Shared by the quiz editor and results skeletons, which
 * previously repeated this 3-column grid verbatim at two sizes.
 */
function OptionSkeleton({ size = "sm" }: { size?: "sm" | "lg" }) {
  const isLarge = size === "lg";
  return (
    <div
      className={`border border-border bg-background ${isLarge ? "px-4 py-4" : "px-3 py-2"}`}
    >
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
        <Shimmer
          h={isLarge ? "h-6" : "h-4"}
          w={isLarge ? "w-6" : "w-4"}
          tone="soft"
          on="border"
          className="mt-0.5"
        />
        <div className="space-y-2">
          <Shimmer h="h-4" w="w-full" on="border" />
          <Shimmer h="h-4" w="w-3/4" tone="soft" on="border" />
        </div>
        <Shimmer
          h={isLarge ? "h-6" : "h-4"}
          w={isLarge ? "w-10" : "w-8"}
          tone="soft"
          on="border"
          className="mt-0.5"
        />
      </div>
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <div className="border border-border bg-surface p-6">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Shimmer h="h-4" w="w-4" tone="soft" on="border" className="mt-0.5" />
          <div>
            <Shimmer h="h-4" w="w-48" on="border" />
            <Shimmer
              h="h-4"
              w="w-10"
              tone="soft"
              on="border"
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Shimmer h="h-4" w="w-8" tone="soft" on="border" />
          <Shimmer h="h-4" w="w-10" tone="soft" on="border" />
        </div>
      </div>

      <div className="ml-6 grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <OptionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
