const SIZES = {
  sm: { mark: 22, text: "text-[0.9375rem]" },
  md: { mark: 30, text: "text-xl" },
  lg: { mark: 44, text: "text-3xl" },
} as const;

/** The pixel-built mark, drawn on the same square grid as the icon set. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="8" y="18" width="16" height="4" fill="var(--color-primary)" />
      <rect x="10" y="14" width="12" height="4" fill="var(--color-primary)" />
      <rect x="12" y="10" width="8" height="4" fill="var(--color-primary)" />
      <path d="M22 12 L28 8 L26 14 Z" fill="var(--color-accent)" />
      <path d="M10 12 L4 8 L6 14 Z" fill="var(--color-accent)" />
      <rect
        x="10"
        y="22"
        width="4"
        height="8"
        fill="var(--color-border-strong)"
      />
      <rect
        x="18"
        y="22"
        width="4"
        height="8"
        fill="var(--color-border-strong)"
      />
    </svg>
  );
}

export function Logo({
  size = "sm",
  wordmark = true,
}: {
  size?: keyof typeof SIZES;
  wordmark?: boolean;
}) {
  const { mark, text } = SIZES[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={mark} />
      {wordmark && (
        <span
          className={`${text} leading-none font-extrabold tracking-[0.2em] text-foreground uppercase select-none`}
        >
          Hermes
        </span>
      )}
    </span>
  );
}
