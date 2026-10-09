import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS ignores SVG touch icons, so the home-screen icon is drawn as a PNG. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#101010",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
        <rect x="8" y="18" width="16" height="4" fill="#005fd0" />
        <rect x="10" y="14" width="12" height="4" fill="#005fd0" />
        <rect x="12" y="10" width="8" height="4" fill="#005fd0" />
        <path d="M22 12 L28 8 L26 14 Z" fill="#92c1fd" />
        <path d="M10 12 L4 8 L6 14 Z" fill="#92c1fd" />
        <rect x="10" y="22" width="4" height="8" fill="#383838" />
        <rect x="18" y="22" width="4" height="8" fill="#383838" />
      </svg>
    </div>,
    size,
  );
}
