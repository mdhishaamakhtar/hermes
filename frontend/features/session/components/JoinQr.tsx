"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** Modules of quiet zone around the code, which scanners need to find it. */
const QUIET = 3;

/**
 * The join link as a QR code, drawn on the same square grid as the logo:
 * video-black modules on legal white, no rounding. Dark on light because
 * that is what every phone camera reads first time; the light square is the
 * one bright thing in the lobby, and it should be.
 */
export function JoinQr({
  url,
  className = "",
}: {
  url: string;
  className?: string;
}) {
  const { path, size } = useMemo(() => {
    const { data, size } = encode(url, { ecc: "M", border: 0 });
    let d = "";
    data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, size };
  }, [url]);

  return (
    <svg
      viewBox={`${-QUIET} ${-QUIET} ${size + QUIET * 2} ${size + QUIET * 2}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code that opens the join page"
      className={className}
    >
      <rect
        x={-QUIET}
        y={-QUIET}
        width={size + QUIET * 2}
        height={size + QUIET * 2}
        fill="var(--color-foreground)"
      />
      <path d={path} fill="var(--color-background)" />
    </svg>
  );
}
