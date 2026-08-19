import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

export const socialImageAlt = "Hermes social preview";

/*
 * The OG renderer cannot use the same font files the browser does. Satori's
 * opentype parser rejects Monaspace's GSUB table — that lookup is
 * texture-healing, which is meaningless in a static 1200x630 render anyway —
 * so lib/og-fonts holds stripped TTF subsets built by
 * scripts/build-og-fonts.py. Regenerate them when bumping @fontsource.
 */
function loadFont(family: "neon" | "krypton", weight: 400 | 700) {
  return readFile(
    join(process.cwd(), `lib/og-fonts/monaspace-${family}-${weight}.ttf`),
  );
}

const FONT_BODY = "Monaspace Neon";
const FONT_DISPLAY = "Monaspace Krypton";

export async function createSocialImage() {
  const [neonRegular, kryptonRegular, kryptonBold] = await Promise.all([
    loadFont("neon", 400),
    loadFont("krypton", 400),
    loadFont("krypton", 700),
  ]);

  /*
   * Optical margin corrections derived from Monaspace hmtx left-side-bearings.
   * Every glyph has invisible padding before its ink starts. At large sizes
   * this becomes visible misalignment. Values below shift each text element
   * left by its exact LSB so all ink edges align with geometric elements
   * (the divider line, the icon viewBox crop).
   *
   * Monaspace is drawn on a 2000-unit em, and its sidebearings are wider than
   * a proportional face's because every glyph is centred in a fixed advance —
   * so these corrections matter more here, not less.
   *
   * Krypton Bold    H: lsb 145/2000em → 9.28px @128px
   * Neon Regular    R: lsb 177/2000em → 3.01px @34px
   * Krypton Regular R: lsb 187/2000em → 1.68px @18px
   */
  const LSB_TITLE = -9.3; // Krypton Bold "H" at 128px
  const LSB_BODY = -3; // Neon Regular "R" at 34px
  const LSB_META = -1.7; // Krypton Regular "R" at 18px

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
        fontFamily: FONT_BODY,
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
              fontFamily: FONT_DISPLAY,
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
              fontFamily: FONT_DISPLAY,
              fontSize: 128,
              lineHeight: 0.9,
              fontWeight: 700,
              /*
               * Geist ran this at -0.07em to close the gaps a proportional
               * display setting opens up. Monaspace has no such gaps — every
               * glyph already sits in a 0.62em advance — so negative tracking
               * only jams the stems together. Slightly positive instead.
               */
              letterSpacing: "0.02em",
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
              fontFamily: FONT_DISPLAY,
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
              fontFamily: FONT_DISPLAY,
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
          name: FONT_BODY,
          data: neonRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: FONT_DISPLAY,
          data: kryptonRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: FONT_DISPLAY,
          data: kryptonBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
