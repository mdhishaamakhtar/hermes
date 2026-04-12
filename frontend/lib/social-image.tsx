import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

export const socialImageAlt = "Hermes social preview";

const GEIST_FONT_DIR = join(
  process.cwd(),
  "node_modules/geist/dist/fonts/geist-sans",
);

function loadFont(name: string) {
  return readFile(join(GEIST_FONT_DIR, name));
}

export async function createSocialImage() {
  const [geistRegular, geistBold] = await Promise.all([
    loadFont("Geist-Regular.ttf"),
    loadFont("Geist-Bold.ttf"),
  ]);

  /*
   * Optical margin corrections derived from Geist TTF hmtx left-side-bearings.
   * Every glyph has invisible padding before its ink starts. At large sizes
   * this becomes visible misalignment. Values below shift each text element
   * left by its exact LSB so all ink edges align with geometric elements
   * (the divider line, the icon viewBox crop).
   *
   * Geist Bold  H: lsb 74/1000em → 9.47px @128px
   * Geist Regular R: lsb 92/1000em → 3.13px @34px, 1.66px @18px
   * Geist Regular H: lsb 92/1000em → 2.02px @22px
   */
  const LSB_TITLE = -9.5; // Bold "H" at 128px
  const LSB_BODY = -3; // Regular "R" at 34px
  const LSB_META = -1.5; // Regular "R" at 18px

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
        fontFamily: "Geist",
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
          name: "Geist",
          data: geistRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Geist",
          data: geistBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
