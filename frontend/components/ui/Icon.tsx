import type { SVGProps } from "react";

/*
 * Hermes icons: one 20px grid, one 1.5px stroke, square caps and mitred
 * joins, drawn to match the pixel-built logo mark. Every icon is decorative
 * (aria-hidden); the control that holds it carries the accessible name.
 */
const PATHS = {
  "arrow-right": "M3 10h13M11 5l5 5-5 5",
  "arrow-left": "M17 10H4M9 5l-5 5 5 5",
  "arrow-up": "M10 17V4M5 9l5-5 5 5",
  "arrow-down": "M10 3v13M5 11l5 5 5-5",
  "chevron-down": "M5 8l5 5 5-5",
  "chevron-right": "M8 5l5 5-5 5",
  plus: "M10 4v12M4 10h12",
  close: "M5 5l10 10M15 5L5 15",
  check: "M4 10.5l4 4 8-9",
  copy: "M7 7h9v9H7zM4 13V4h9",
  link: "M8.5 11.5l3-3M9.5 5.5l1-1a3.2 3.2 0 014.5 4.5l-1 1M10.5 14.5l-1 1A3.2 3.2 0 015 11l1-1",
  pencil: "M13 4l3 3-8.5 8.5H4.5v-3zM11 6l3 3",
  trash: "M4 6h12M8 6V4h4v2M5.8 6l.9 10h6.6l.9-10",
  play: "M6.5 4.5v11l8.5-5.5z",
  stop: "M5.5 5.5h9v9h-9z",
  clock: "M17 10a7 7 0 11-14 0 7 7 0 0114 0zM10 6v4l2.5 2",
  user: "M13 7a3 3 0 11-6 0 3 3 0 016 0zM4 17c0-3.3 2.7-6 6-6s6 2.7 6 6",
  lock: "M5 9h10v8H5zM7 9V6a3 3 0 016 0v3",
  refresh: "M16.5 10a6.5 6.5 0 11-2-4.7M16.5 3.5v3h-3",
  "sign-out": "M8 4H4v12h4M12 6l4 4-4 4M16 10H8",
  alert: "M10 3l7.5 13.5h-15zM10 8v3.5M10 13.5v.5",
  info: "M17 10a7 7 0 11-14 0 7 7 0 0114 0zM10 9v5M10 6.5v.5",
  eye: "M2.5 10S5.2 5 10 5s7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5zM12 10a2 2 0 11-4 0 2 2 0 014 0z",
  "eye-off":
    "M3 3l14 14M8.3 5.2A7.7 7.7 0 0110 5c4.8 0 7.5 5 7.5 5a13 13 0 01-1.9 2.4M13.7 13.9A7 7 0 0110 15c-4.8 0-7.5-5-7.5-5a13 13 0 013-3.4",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
