interface SpinnerProps {
  size?: "sm" | "md";
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  const shell = size === "sm" ? "w-10 h-10" : "w-14 h-14";
  const core = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className={`loader-orbit ${shell}`} role="status" aria-label="Loading">
      <span className="loader-ring" />
      <span className={`loader-core ${core}`} />
    </div>
  );
}
