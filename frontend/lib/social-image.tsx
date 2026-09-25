import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

export const socialImageAlt = "Hermes social preview";

// Satori reads WOFF but not the WOFF2 that next/font serves, so the social
// image loads the static instances @fontsource ships.
const FONT_DIR = join(
  process.cwd(),
  "node_modules/@fontsource/schibsted-grotesk/files",
);

function loadFont(name: string) {
  return readFile(join(FONT_DIR, name));
}

export async function createSocialImage() {
  const [sansRegular, sansBold] = await Promise.all([
    loadFont("schibsted-grotesk-latin-400-normal.woff"),
    loadFont("schibsted-grotesk-latin-800-normal.woff"),
  ]);

  const LSB_TITLE = 0;
  const LSB_BODY = 0;
  const LSB_META = 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#0a0a0f",
        color: "#f8fafc",
        fontFamily: "Schibsted Grotesk",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 74px 54px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg
            width="34"
            height="34"
            viewBox="4 8 24 22"
            fill="none"
            aria-hidden="true"
          >
            <rect x="8" y="18" width="16" height="4" fill="#2563EB" />
            <rect x="10" y="14" width="12" height="4" fill="#2563EB" />
            <rect x="12" y="10" width="8" height="4" fill="#2563EB" />
            <path d="M22 12 L28 8 L26 14 Z" fill="#38BDF8" />
            <path d="M10 12 L4 8 L6 14 Z" fill="#38BDF8" />
            <rect x="10" y="22" width="4" height="8" fill="#1A1F2E" />
            <rect x="18" y="22" width="4" height="8" fill="#1A1F2E" />
          </svg>
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#7dd3fc",
            }}
          >
            Hermes
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 760,
            marginTop: "-60px",
          }}
        >
          <div
            style={{
              fontSize: 128,
              lineHeight: 0.9,
              fontWeight: 700,
              letterSpacing: "-0.07em",
              marginLeft: LSB_TITLE,
            }}
          >
            HERMES
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.22,
              color: "#cbd5e1",
              maxWidth: 700,
              marginLeft: LSB_BODY,
            }}
          >
            {siteConfig.shortDescription}
          </div>
          <div
            style={{
              width: 96,
              height: 2,
              background: "#2563EB",
              marginTop: 10,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginLeft: LSB_META,
            }}
          >
            Real-time • WebSocket • Anonymous Participants
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#60a5fa",
            }}
          >
            hermes.hishaam.dev
          </div>
        </div>
      </div>
    </div>,
    {
      ...socialImageSize,
      fonts: [
        {
          name: "Schibsted Grotesk",
          data: sansRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Schibsted Grotesk",
          data: sansBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
