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
      <div className="space-y-2">
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
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="h-3 w-16 bg-surface/50 animate-pulse mb-2" />
          <div className="h-8 w-24 bg-surface animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-surface animate-pulse" />
      </div>
      <div className="h-px bg-border mb-8" />
      <div className="space-y-2">
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
      <div className="space-y-2">
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
          <QuestionSkeleton key={i} />
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
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <LeaderboardRowSkeleton key={i} />
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

// --- Row skeletons matching real component internals ---

// Matches ResourceRow: px-6 py-4, title + optional subtitle, arrow on right
function RowSkeleton({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-surface border border-border">
      <div>
        <div className="h-4 w-36 bg-border animate-pulse" />
        {subtitle && (
          <div className="h-3 w-24 bg-border/50 animate-pulse mt-2" />
        )}
      </div>
      <div className="h-4 w-4 bg-border/50 animate-pulse" />
    </div>
  );
}

// Matches quiz rows in EventClient: order number + title
function QuizRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-surface border border-border">
      <div className="flex items-center gap-4">
        <div className="h-3 w-5 bg-border/50 animate-pulse" />
        <div className="h-4 w-32 bg-border animate-pulse" />
      </div>
      <div className="h-4 w-4 bg-border/50 animate-pulse" />
    </div>
  );
}

// Matches QuestionCard: p-6, order + text + time, options grid
function QuestionSkeleton() {
  return (
    <div className="border border-border bg-surface p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="h-3 w-4 bg-border/50 animate-pulse mt-0.5" />
          <div>
            <div className="h-4 w-48 bg-border animate-pulse" />
            <div className="h-3 w-10 bg-border/50 animate-pulse mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-3 w-8 bg-border/50 animate-pulse" />
          <div className="h-3 w-10 bg-border/50 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 ml-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="px-3 py-1.5 border border-border h-7 animate-pulse bg-border/20"
          />
        ))}
      </div>
    </div>
  );
}

// Matches LeaderboardRow (review variant): px-6 py-4, rank + name + score
function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-surface border border-border">
      <div className="flex items-center gap-5">
        <div className="h-5 w-8 bg-border animate-pulse" />
        <div className="h-4 w-28 bg-border/50 animate-pulse" />
      </div>
      <div className="h-4 w-12 bg-border animate-pulse" />
    </div>
  );
}
