interface SpinnerProps {
  size?: "sm" | "md";
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div
      className={`${dim} border border-primary border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}
