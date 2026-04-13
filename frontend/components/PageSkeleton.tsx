export function NavPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background/80">
        <div className="mx-auto h-14 max-w-4xl px-6" />
      </div>
      <ContentSkeleton />
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-3 h-4 w-16 bg-surface/50 skeleton" />
      <div className="mb-10 h-7 w-48 bg-surface skeleton" />
      <div className="list-stack">
        {[1, 2, 3].map((i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Dashboard: shimmer rows matching event cards
export function EventListSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="mb-2 h-3 w-16 bg-surface/50 skeleton" />
          <div className="h-8 w-24 bg-surface skeleton" />
        </div>
        <div className="h-9 w-28 bg-surface skeleton" />
      </div>
      <div className="mb-8 h-px bg-border" />
      <div className="list-stack">
        {[1, 2, 3].map((i) => (
          <RowSkeleton key={i} subtitle />
        ))}
      </div>
    </div>
  );
}

// Event page: back link + title + quiz list rows
export function EventDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 h-3 w-20 bg-surface/50 skeleton" />
      <div className="mb-10">
        <div className="mb-2 h-3 w-10 bg-surface/50 skeleton" />
        <div className="mb-2 h-8 w-56 bg-surface skeleton" />
        <div className="h-3 w-40 bg-surface/50 skeleton" />
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-3 w-14 bg-surface/50 skeleton" />
        <div className="h-8 w-24 bg-surface skeleton" />
      </div>
      <div className="mb-4 h-px bg-border" />
      <div className="list-stack">
        {[1, 2, 3].map((i) => (
          <QuizRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Quiz editor: back link + header + question rows
export function QuizEditorSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 h-3 w-14 bg-surface/50 skeleton" />
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="mb-2 h-3 w-20 bg-surface/50 skeleton" />
          <div className="h-8 w-48 bg-surface skeleton" />
        </div>
        <div className="h-11 w-36 bg-surface skeleton" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-3 w-24 bg-surface/50 skeleton" />
        <div className="h-3 w-24 bg-surface/50 skeleton" />
      </div>
      <div className="mb-4 h-px bg-border" />
      <div className="list-stack">
        {[1, 2, 3].map((i) => (
          <QuestionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Review: back link + title + summary + tabs + leaderboard rows
export function ReviewSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 h-3 w-24 bg-surface/50 skeleton" />
      <div className="mb-10">
        <div className="mb-2 h-3 w-28 bg-surface/50 skeleton" />
        <div className="mb-2 h-7 w-64 bg-surface skeleton" />
        <div className="h-3 w-40 bg-surface/50 skeleton" />
      </div>

      <div className="mb-8 border border-border bg-surface px-6 py-5">
        <div className="mb-2 h-3 w-24 bg-border/50 skeleton" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="h-8 w-64 bg-border skeleton" />
          <div className="flex gap-3">
            <div className="h-3 w-16 bg-border/50 skeleton" />
            <div className="h-3 w-20 bg-border/50 skeleton" />
          </div>
        </div>
      </div>

      <div className="mb-8 flex gap-0 border-b border-border">
        <div className="h-12 w-32 bg-surface skeleton" />
        <div className="h-12 w-28 bg-surface/60 skeleton" />
      </div>

      <div className="list-stack">
        {[1, 2, 3, 4].map((i) => (
          <LeaderboardRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ReviewPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-background/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <div className="h-4 w-28 bg-surface skeleton" />
          <div className="flex items-center gap-6">
            <div className="h-4 w-32 bg-surface/50 skeleton" />
            <div className="h-3 w-16 bg-surface/50 skeleton" />
          </div>
        </div>
      </div>
      <ReviewSkeleton />
    </div>
  );
}

// Session lobby pages (host / play) loading state
export function SessionPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="h-4 w-20 bg-surface skeleton" />
          <div className="flex items-center gap-3">
            <div className="h-7 w-16 border border-border bg-surface/80 skeleton" />
            <div className="flex flex-col items-end gap-1">
              <div className="h-4 w-10 bg-surface skeleton" />
              <div className="h-3 w-24 bg-surface/50 skeleton" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full flex-col items-center">
          <div className="mb-8 h-3 w-44 bg-surface/50 skeleton" />

          <div className="w-full max-w-lg bg-surface px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto mb-5 h-3 w-28 bg-border/50 skeleton" />
            <div className="mx-auto h-12 w-full max-w-[20rem] bg-border skeleton" />
            <div className="mx-auto mt-4 h-3 w-2/3 bg-border/50 skeleton" />
          </div>

          <div className="mt-5 h-10 w-32 border border-border bg-background/80 skeleton" />

          <div className="mt-14 w-full max-w-xs border-t border-border pt-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-16 bg-surface skeleton" />
              <div className="h-3 w-24 bg-surface/50 skeleton" />
            </div>
          </div>

          <div className="mt-12 h-11 w-40 bg-surface skeleton" />
          <div className="mt-6 h-3 w-20 bg-surface/40 skeleton" />
        </div>
      </main>
    </div>
  );
}

// Results page: header + score card + question result rows
export function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="h-4 w-20 bg-surface skeleton" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 bg-surface/50 skeleton" />
            <div className="h-3 w-24 bg-surface/50 skeleton" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 h-3 w-24 bg-surface/50 skeleton" />

        <div className="mb-4 border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-3 h-3 w-16 bg-border/50 skeleton" />
              <div className="h-10 w-32 bg-border skeleton" />
              <div className="mt-3 h-3 w-12 bg-border/50 skeleton" />
            </div>
            <div className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:min-w-[18rem]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border border-border bg-background p-4">
                  <div className="mx-auto h-8 w-16 bg-border skeleton" />
                  <div className="mx-auto mt-2 h-3 w-12 bg-border/50 skeleton" />
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
                  <div className="mb-2 h-3 w-28 bg-border/50 skeleton" />
                  <div className="h-6 w-56 bg-border skeleton" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="h-3 w-16 bg-border/50 skeleton" />
                  <div className="h-3 w-14 bg-border/50 skeleton" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="border border-border bg-background px-4 py-4"
                  >
                    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
                      <div className="mt-0.5 h-6 w-6 bg-border/40 skeleton" />
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-border skeleton" />
                        <div className="h-4 w-3/4 bg-border/50 skeleton" />
                      </div>
                      <div className="mt-0.5 h-6 w-10 bg-border/40 skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// --- Row skeletons matching real component internals ---

function RowSkeleton({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center justify-between border border-border bg-surface px-6 py-4">
      <div>
        <div className="h-4 w-36 bg-border skeleton" />
        {subtitle ? (
          <div className="mt-2 h-3 w-24 bg-border/50 skeleton" />
        ) : null}
      </div>
      <div className="h-4 w-4 bg-border/50 skeleton" />
    </div>
  );
}

function QuizRowSkeleton() {
  return (
    <div className="flex items-center justify-between border border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="h-3 w-5 bg-border/50 skeleton" />
        <div className="h-4 w-32 bg-border skeleton" />
      </div>
      <div className="h-4 w-4 bg-border/50 skeleton" />
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <div className="border border-border bg-surface p-6">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-3 w-4 bg-border/50 skeleton" />
          <div>
            <div className="h-4 w-48 bg-border skeleton" />
            <div className="mt-1.5 h-3 w-10 bg-border/50 skeleton" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-3 w-8 bg-border/50 skeleton" />
          <div className="h-3 w-10 bg-border/50 skeleton" />
        </div>
      </div>

      <div className="ml-6 grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-border bg-background px-3 py-2">
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
              <div className="mt-0.5 h-4 w-4 bg-border/40 skeleton" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-border skeleton" />
                <div className="h-4 w-3/4 bg-border/50 skeleton" />
              </div>
              <div className="mt-0.5 h-4 w-8 bg-border/40 skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center justify-between border border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-5">
        <div className="h-5 w-8 bg-border skeleton" />
        <div className="h-4 w-28 bg-border/50 skeleton" />
      </div>
      <div className="h-4 w-12 bg-border skeleton" />
    </div>
  );
}
