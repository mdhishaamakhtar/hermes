import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface Look {
  variant?: Variant;
  size?: Size;
  /** Leading icon. Alone (no children) it makes a square icon button. */
  icon?: IconName;
  /** Trailing icon; nudges forward on hover, so reserve it for "go" actions. */
  trailingIcon?: IconName;
}

function buttonClass(
  { variant = "secondary", size = "md" }: Look,
  iconOnly: boolean,
  className = "",
) {
  return [
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    iconOnly && "btn-icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function Content({
  icon,
  trailingIcon,
  size,
  children,
}: Look & { children?: React.ReactNode }) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {trailingIcon && (
        <Icon name={trailingIcon} size={iconSize} className="btn-trail" />
      )}
    </>
  );
}

interface ButtonProps extends Look, ComponentProps<"button"> {
  /**
   * A request is in flight. The button keeps focus and full strength, sweeps
   * while it waits, and ignores further presses, including Enter in a form.
   */
  pending?: boolean;
}

export function Button({
  variant,
  size,
  icon,
  trailingIcon,
  pending = false,
  className,
  children,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      className={buttonClass({ variant, size }, !children, className)}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={handleClick}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = Look & ComponentProps<typeof Link>;

export function ButtonLink({
  variant,
  size,
  icon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass({ variant, size }, !children, className)}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Content>
    </Link>
  );
}
