"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { describeError } from "@/lib/api";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** "drawer" docks to the right edge for longer editing tasks. */
  variant?: "modal" | "drawer";
  /** False while a request is in flight: Escape and backdrop clicks wait. */
  dismissible?: boolean;
}

/**
 * A controlled native <dialog>. showModal() supplies the focus trap, Escape,
 * and an inert page behind it; the open/close animation lives in globals.css.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs at mount, while the dialog is still closed,
      // so showModal() would fall back to the first control (the close
      // button). Content marks its intended first stop with data-autofocus.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={`dialog ${variant === "drawer" ? "drawer" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        // A click that lands on the <dialog> itself hit the backdrop.
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg leading-snug font-bold text-foreground"
            >
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-2 text-sm text-muted">
                {description}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            aria-label="Close"
            onClick={requestClose}
            disabled={!dismissible}
            className="-mr-2 shrink-0"
          />
        </header>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        )}
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** May be async. A rejection keeps the dialog open and shows why. */
  onConfirm: () => unknown;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "danger",
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (err) {
      setError(describeError(err, "That didn't go through. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      dismissible={!pending}
      footer={
        <>
          {error && (
            <p
              role="alert"
              className="mr-auto flex items-start gap-1.5 text-sm text-danger"
            >
              <Icon name="alert" size={14} className="mt-[3px] shrink-0" />
              {error}
            </p>
          )}
          <Button
            variant="ghost"
            onClick={close}
            disabled={pending}
            data-autofocus
          >
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={confirm}
            pending={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
