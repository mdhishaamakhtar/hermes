import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSiteUrl, siteConfig } from "@/lib/site";

export const socialImageSize = { width: 1200, height: 630 } as const;
export const socialImageAlt = siteConfig.ogImageAlt;

// Satori reads WOFF but not the WOFF2 that next/font serves, and it cannot
// drive a variable width axis, so the social image loads static instances
// from @fontsource. Archivo Narrow stands in for the app's narrowed Archivo.
function font(pkg: string, file: string) {
  return readFile(
    join(process.cwd(), "node_modules/@fontsource", pkg, "files", file),
  );
}

/*
 * Satori cannot read CSS variables, so these mirror the palette in
 * app/globals.css by value. Change one, change the other.
 */
const PALETTE = {
  black: "#101010", // video black
  surface: "#161616",
  rule: "#383838",
  white: "#ebebeb", // legal white
  muted: "#a8a8a8",
  key: "#005fd0",
  keyLight: "#92c1fd",
  tally: "#ec5542",
  bars: ["#e0d653", "#0fd8da", "#bc8ef4", "#cf6192"],
};

const SAMPLE_CODE = "K7Q2XM";

/**
 * The card link previews show, framed like the app's own stage: the tally
 * lit, the promise in the on-screen graphics voice, and the two things a
 * player meets first: a join code, and four lettered answers.
 */
export async function createSocialImage() {
  const [sans, narrow, mono] = await Promise.all([
    font("schibsted-grotesk", "schibsted-grotesk-latin-400-normal.woff"),
    font("archivo-narrow", "archivo-narrow-latin-700-normal.woff"),
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
        padding: "60px 72px",
        background: PALETTE.black,
        color: PALETTE.white,
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
            <rect x="8" y="18" width="16" height="4" fill={PALETTE.key} />
            <rect x="10" y="14" width="12" height="4" fill={PALETTE.key} />
            <rect x="12" y="10" width="8" height="4" fill={PALETTE.key} />
            <path d="M22 12 L28 8 L26 14 Z" fill={PALETTE.keyLight} />
            <path d="M10 12 L4 8 L6 14 Z" fill={PALETTE.keyLight} />
            <rect x="10" y="22" width="4" height="8" fill={PALETTE.rule} />
            <rect x="18" y="22" width="4" height="8" fill={PALETTE.rule} />
          </svg>
          <div
            style={{
              fontFamily: "Archivo Narrow",
              fontSize: 30,
              letterSpacing: 6,
            }}
          >
            HERMES
          </div>
        </div>
        {/* The tally, lit: a steady square lamp, ink on red. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: PALETTE.tally,
            color: PALETTE.black,
            fontFamily: "Archivo Narrow",
            fontSize: 24,
            letterSpacing: 4,
          }}
        >
          <div style={{ width: 11, height: 11, background: PALETTE.black }} />
          ON AIR
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Archivo Narrow",
          fontSize: 132,
          lineHeight: 0.88,
          letterSpacing: -3,
        }}
      >
        <span>Live quizzes,</span>
        <span>run like a broadcast.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {SAMPLE_CODE.split("").map((character, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 58,
                  height: 70,
                  background: PALETTE.surface,
                  border: `1px solid ${PALETTE.rule}`,
                  fontFamily: "Azeret Mono",
                  fontSize: 36,
                }}
              >
                {character}
              </div>
            ))}
          </div>
          {/* The four answer lamps, lettered, in colour-bar order. */}
          <div style={{ display: "flex", gap: 8 }}>
            {PALETTE.bars.map((colour, index) => (
              <div
                key={colour}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  background: colour,
                  color: PALETTE.black,
                  fontFamily: "Azeret Mono",
                  fontSize: 22,
                }}
              >
                {"ABCD"[index]}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
            fontSize: 24,
            color: PALETTE.muted,
          }}
        >
          <span>Players join from any phone.</span>
          <span
            style={{
              fontFamily: "Azeret Mono",
              fontSize: 20,
              color: PALETTE.keyLight,
            }}
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
          name: "Archivo Narrow",
          data: narrow,
          style: "normal",
          weight: 700,
        },
        { name: "Azeret Mono", data: mono, style: "normal", weight: 600 },
      ],
    },
  );
}
