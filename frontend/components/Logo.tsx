interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}

const sizes = {
  sm: { svg: 24, text: "text-base" },
  md: { svg: 32, text: "text-xl" },
  lg: { svg: 48, text: "text-3xl" },
};

export default function Logo({ size = "md", showWordmark = true }: LogoProps) {
  const { svg, text } = sizes[size];
  return (
    <div className="flex items-center gap-3">
      <svg
        width={svg}
        height={svg}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect x="8" y="18" width="16" height="4" fill="var(--color-primary)" />
        <rect x="10" y="14" width="12" height="4" fill="var(--color-primary)" />
        <rect x="12" y="10" width="8" height="4" fill="var(--color-primary)" />
        <path d="M22 12 L28 8 L26 14 Z" fill="var(--color-accent)" />
        <path d="M10 12 L4 8 L6 14 Z" fill="var(--color-accent)" />
        <rect x="10" y="22" width="4" height="8" fill="var(--color-border)" />
        <rect x="18" y="22" width="4" height="8" fill="var(--color-border)" />
      </svg>
      {showWordmark && (
        <span
          className={`${text} font-black tracking-widest uppercase text-foreground select-none`}
        >
          HERMES
        </span>
      )}
    </div>
  );
}
