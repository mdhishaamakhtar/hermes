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

export function SessionPageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-5 h-5 border border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
