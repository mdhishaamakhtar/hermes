import { Archivo, Azeret_Mono, Schibsted_Grotesk } from "next/font/google";

/*
 * Archivo, on its width axis, is the on-screen graphics voice: questions,
 * slates, headlines, the tally. Narrowed, it fits a long question on one
 * projector line at a size the back row can read.
 * Schibsted Grotesk carries the interface: labels, body, controls.
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

export const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
