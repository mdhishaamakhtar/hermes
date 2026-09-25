import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSiteUrl, siteConfig } from "@/lib/site";

export const socialImageSize = { width: 1200, height: 630 } as const;
export const socialImageAlt = siteConfig.ogImageAlt;

// Satori reads WOFF but not the WOFF2 that next/font serves, so the social
// image loads the static instances @fontsource ships.
function font(pkg: string, file: string) {
  return readFile(
    join(process.cwd(), "node_modules/@fontsource", pkg, "files", file),
  );
}

const INK = {
  stage: "#0a0a0f",
  surface: "#0f1117",
  rule: "#2a3144",
  text: "#f8fafc",
  muted: "#94a3b8",
  blue: "#2563eb",
  sky: "#38bdf8",
};

const SAMPLE_CODE = "K7Q2XM";

/** The card link previews show: the promise, and the join code that keeps it. */
export async function createSocialImage() {
  const [sans, sansBold, mono] = await Promise.all([
    font("schibsted-grotesk", "schibsted-grotesk-latin-400-normal.woff"),
    font("schibsted-grotesk", "schibsted-grotesk-latin-800-normal.woff"),
    font("azeret-mono", "azeret-mono-latin-600-normal.woff"),
  ]);
  const host = new URL(getSiteUrl()).host;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: INK.stage,
        color: INK.text,
        fontFamily: "Schibsted Grotesk",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect x="8" y="18" width="16" height="4" fill={INK.blue} />
            <rect x="10" y="14" width="12" height="4" fill={INK.blue} />
            <rect x="12" y="10" width="8" height="4" fill={INK.blue} />
            <path d="M22 12 L28 8 L26 14 Z" fill={INK.sky} />
            <path d="M10 12 L4 8 L6 14 Z" fill={INK.sky} />
            <rect x="10" y="22" width="4" height="8" fill={INK.rule} />
            <rect x="18" y="22" width="4" height="8" fill={INK.rule} />
          </svg>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5 }}>
            HERMES
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            border: `1px solid ${INK.sky}66`,
            color: INK.sky,
            fontSize: 18,
            letterSpacing: 3,
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: 9,
              background: INK.sky,
            }}
          />
          LIVE
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 92,
          fontWeight: 800,
          lineHeight: 0.98,
          letterSpacing: -2.5,
        }}
      >
        <span>Live quizzes,</span>
        <span>run like a broadcast.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {SAMPLE_CODE.split("").map((character, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 76,
                background: INK.surface,
                border: `1px solid ${INK.rule}`,
                fontFamily: "Azeret Mono",
                fontSize: 40,
                fontWeight: 600,
              }}
            >
              {character}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
            fontSize: 24,
            color: INK.muted,
          }}
        >
          <span>Players join from any phone.</span>
          <span
            style={{ fontFamily: "Azeret Mono", fontSize: 20, color: INK.sky }}
          >
            {host}
          </span>
        </div>
      </div>
    </div>,
    {
      ...socialImageSize,
      fonts: [
        { name: "Schibsted Grotesk", data: sans, style: "normal", weight: 400 },
        {
          name: "Schibsted Grotesk",
          data: sansBold,
          style: "normal",
          weight: 800,
        },
        { name: "Azeret Mono", data: mono, style: "normal", weight: 600 },
      ],
    },
  );
}
