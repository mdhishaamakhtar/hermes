import { Azeret_Mono, Schibsted_Grotesk } from "next/font/google";

/*
 * Schibsted Grotesk carries the voice: headings, labels, body.
 * Azeret Mono carries data: join codes, clocks, scores, point values, and
 * anything a person types. Its slashed zero keeps "0" and "O" apart in a
 * projected join code, where the alphabet uses both.
 *
 * Shared by the root layout and global-error, which renders its own document.
 */
export const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

export const mono = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-azeret",
  display: "swap",
});
