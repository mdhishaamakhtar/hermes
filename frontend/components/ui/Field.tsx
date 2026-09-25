"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

/** Ids for a control and its message, so screen readers announce both. */
function useFieldIds(idProp: string | undefined, { hint, error }: FieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return { id, describedBy };
}

/**
 * Label, control, and one message beneath it: the error when there is one,
 * otherwise the hint. Use directly for custom controls; TextField and
 * TextAreaField wrap it for plain inputs.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: FieldProps & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="text-sm font-medium text-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <Icon name="alert" size={14} className="mt-[3px] shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends FieldProps, ComponentProps<"input"> {
  /** A unit shown inside the field's right edge, e.g. "sec". */
  suffix?: string;
  fieldClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  suffix,
  id: idProp,
  className = "",
  fieldClassName,
  ...inputProps
}: TextFieldProps) {
  const { id, describedBy } = useFieldIds(idProp, { label, hint, error });
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={fieldClassName}
    >
      <div className="relative">
        <input
          id={id}
          className={`input ${suffix ? "pr-12" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center font-mono text-sm text-subtle"
          >
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  id: idProp,
  className = "",
  ...inputProps
}: FieldProps & Omit<ComponentProps<"input">, "type">) {
  const { id, describedBy } = useFieldIds(idProp, { label, hint, error });
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`input pr-12 font-mono ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-subtle transition-colors hover:text-foreground"
        >
          <Icon name={visible ? "eye-off" : "eye"} size={16} />
        </button>
      </div>
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id: idProp,
  className = "",
  ...textareaProps
}: FieldProps & ComponentProps<"textarea">) {
  const { id, describedBy } = useFieldIds(idProp, { label, hint, error });
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...textareaProps}
      />
    </Field>
  );
}
