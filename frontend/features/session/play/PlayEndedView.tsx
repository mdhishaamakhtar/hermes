"use client";

export function PlayEndedView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <div className="flex items-center gap-2">
        {([0, 0.15, 0.3] as const).map((delay, i) => (
          <span
            key={i}
            className="live-dot h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <p className="label text-muted">Session ended</p>
    </div>
  );
}
