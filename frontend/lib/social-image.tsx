import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

export const socialImageAlt = "Hermes social preview";

async function loadGeistRegular() {
  return readFile(
    join(
      process.cwd(),
      "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
    ),
  );
}

export async function createSocialImage() {
  const geistRegular = await loadGeistRegular();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 24% 28%, rgba(37,99,235,0.34), transparent 30%), radial-gradient(circle at 82% 16%, rgba(56,189,248,0.22), transparent 24%), linear-gradient(180deg, #0a0a0f 0%, #0f1117 100%)",
        color: "#f8fafc",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          opacity: 0.22,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 42,
          left: 46,
          right: 46,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 24,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#7dd3fc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg
            width="34"
            height="34"
            viewBox="0 0 32 32"
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
          <span>Hermes</span>
        </div>
        <span style={{ color: "#94a3b8" }}>Live Quiz Platform</span>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          padding: "128px 74px 68px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            maxWidth: 860,
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "12px 18px",
              border: "1px solid rgba(56,189,248,0.28)",
              background: "rgba(15,17,23,0.74)",
              color: "#7dd3fc",
              fontSize: 22,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Host. Join. Score. Repeat.
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 112,
                lineHeight: 0.92,
                fontWeight: 700,
                letterSpacing: "-0.06em",
              }}
            >
              {siteConfig.title}
            </div>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.25,
                color: "#cbd5e1",
                maxWidth: 900,
              }}
            >
              Real-time quiz sessions with live analytics, organiser controls,
              and fast participant joins.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            {["WebSocket", "Analytics", "Anonymous Players"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "12px 18px",
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15,17,23,0.82)",
                  fontSize: 22,
                  color: "#e2e8f0",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.16em",
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
      ],
    },
  );
}
