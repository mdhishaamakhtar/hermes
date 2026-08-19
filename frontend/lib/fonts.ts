import localFont from "next/font/local";

/*
 * Typefaces — the Monaspace superfamily (GitHub Next, SIL OFL).
 *
 * Hermes is monospace end to end. "Terminal as a soul, not a costume" means
 * the grid is the identity, not a decoration applied to a sans-serif shell.
 * Monaspace makes that survivable: every texture shares one metric skeleton,
 * so swapping textures never reflows a layout, and its texture-healing
 * kerning removes the gappy rhythm that normally makes monospace tiring to
 * read at body sizes.
 *
 * Two textures, two jobs:
 *
 *   Neon (--font-body)       Humanist. The most legible texture at small
 *                            sizes and from across a room. Body copy,
 *                            question text, form input — everything a
 *                            participant reads in order to answer.
 *
 *   Krypton (--font-display) Mechanical, squared terminals. Reads as machine
 *                            output rather than prose. Uppercase labels, join
 *                            codes, timers, scores, hero numbers — the
 *                            broadcast furniture.
 *
 * Weights match the roles documented in globals.css §6 (400/500/600/700/800).
 * 800 is the top of the scale — Monaspace ships no 900.
 *
 * The `src` arrays are spelled out rather than generated: next/font/local is
 * resolved at build time by a static analyser, so a loop or helper that
 * builds these entries compiles to nothing and the build fails on a missing
 * `src`. Keep them literal.
 */

export const monaspaceNeon = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/monaspace-neon/files/monaspace-neon-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-neon/files/monaspace-neon-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-neon/files/monaspace-neon-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-neon/files/monaspace-neon-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-neon/files/monaspace-neon-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-monaspace-neon",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const monaspaceKrypton = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/monaspace-krypton/files/monaspace-krypton-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-krypton/files/monaspace-krypton-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-krypton/files/monaspace-krypton-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-krypton/files/monaspace-krypton-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/monaspace-krypton/files/monaspace-krypton-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-monaspace-krypton",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
