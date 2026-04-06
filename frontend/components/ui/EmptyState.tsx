interface EmptyStateProps {
  message: string;
  hint?: string;
}

export default function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <p className="text-muted text-sm tracking-wide mb-2">{message}</p>
      {hint && <p className="text-muted/50 text-xs">{hint}</p>}
    </div>
  );
}
