export function NavPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/80 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-14" />
      </div>
      <ContentSkeleton />
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-4 w-16 bg-surface/50 animate-pulse mb-3" />
      <div className="h-7 w-48 bg-surface animate-pulse mb-10" />
      <div className="space-y-px">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[4.5rem] bg-surface border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// Dashboard: shimmer rows matching event cards
export function EventListSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="h-3 w-16 bg-surface/50 animate-pulse mb-2" />
          <div className="h-8 w-24 bg-surface animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-surface animate-pulse" />
      </div>
      <div className="h-px bg-border mb-8" />
      <div className="space-y-px">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[4.5rem] bg-surface border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// Event page: back link + title + quiz list rows
export function EventDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-3 w-20 bg-surface/50 animate-pulse mb-8" />
      <div className="mb-10">
        <div className="h-3 w-10 bg-surface/50 animate-pulse mb-2" />
        <div className="h-8 w-56 bg-surface animate-pulse mb-2" />
        <div className="h-3 w-40 bg-surface/50 animate-pulse" />
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-3 w-14 bg-surface/50 animate-pulse" />
        <div className="h-8 w-24 bg-surface animate-pulse" />
      </div>
      <div className="h-px bg-border mb-4" />
      <div className="space-y-px">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[3.5rem] bg-surface border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// Quiz editor: back link + header + question rows
export function QuizEditorSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-3 w-14 bg-surface/50 animate-pulse mb-8" />
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="h-3 w-20 bg-surface/50 animate-pulse mb-2" />
          <div className="h-8 w-48 bg-surface animate-pulse" />
        </div>
        <div className="h-11 w-36 bg-surface animate-pulse" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-24 bg-surface/50 animate-pulse" />
        <div className="h-3 w-24 bg-surface/50 animate-pulse" />
      </div>
      <div className="h-px bg-border mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[5.5rem] bg-surface border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// Review: back link + title + tab bar + leaderboard rows
export function ReviewSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-3 w-24 bg-surface/50 animate-pulse mb-8" />
      <div className="mb-10">
        <div className="h-3 w-28 bg-surface/50 animate-pulse mb-2" />
        <div className="h-7 w-64 bg-surface animate-pulse mb-2" />
        <div className="h-3 w-32 bg-surface/50 animate-pulse" />
      </div>
      <div className="h-px bg-border mb-8" />
      <div className="space-y-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[3.5rem] bg-surface border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

export function SessionPageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-5 h-5 border border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
