/**
 * A player's result as a picture to share: a 16:9 frame in the station's
 * own look (video black, the display face, one key-light accent), drawn on
 * a canvas so it needs no server and no upload.
 */
import { ordinal } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import type { MyResults } from "../session-types";

const WIDTH = 1200;
const HEIGHT = 675;
const PAD = 72;

/** The page's own fonts and colours, read back so the card matches it. */
function look() {
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement("span");
  probe.className = "display display-tight";
  probe.hidden = true;
  document.body.append(probe);
  const display = getComputedStyle(probe).fontFamily;
  probe.remove();
  const color = (name: string, fallback: string) =>
    root.getPropertyValue(name).trim() || fallback;
  return {
    display,
    sans: getComputedStyle(document.body).fontFamily,
    mono: root.getPropertyValue("--font-mono").trim() || "monospace",
    background: color("--color-background", "#101010"),
    border: color("--color-border", "#262626"),
    foreground: color("--color-foreground", "#ebebeb"),
    muted: color("--color-muted", "#a3a3a3"),
    subtle: color("--color-subtle", "#737373"),
    accent: color("--color-accent", "#92c1fd"),
  };
}

/** Shortens text to fit a width, ending it with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** Questions asked that had a right answer to get: polls don't count. */
export function scoredCount(results: MyResults): number {
  return results.questions.filter(
    (question) => question.asked && !question.poll,
  ).length;
}

export async function drawShareCard(results: MyResults): Promise<Blob> {
  await document.fonts.ready;
  const style = look();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the card.");

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
  ctx.textBaseline = "alphabetic";

  // The bug: the station's name, top left, as on every screen.
  ctx.fillStyle = style.foreground;
  ctx.font = `700 26px ${style.sans}`;
  ctx.letterSpacing = "6px";
  ctx.fillText(siteConfig.name.toUpperCase(), PAD, PAD + 18);

  // The off-air lamp, top right, as the screens show a finished session: a
  // hollow square and the word, in an outline.
  ctx.font = `600 20px ${style.mono}`;
  ctx.letterSpacing = "4px";
  const tag = "FINAL";
  const tagWidth = ctx.measureText(tag).width;
  const boxWidth = tagWidth + 22 + 36;
  const boxX = WIDTH - PAD - boxWidth;
  ctx.strokeStyle = style.border;
  ctx.strokeRect(boxX, PAD - 14, boxWidth, 44);
  ctx.strokeStyle = style.subtle;
  ctx.strokeRect(boxX + 18, PAD + 3, 10, 10);
  ctx.fillStyle = style.subtle;
  ctx.fillText(tag, boxX + 40, PAD + 15);
  ctx.letterSpacing = "0px";

  // The quiz, as the eyebrow.
  ctx.fillStyle = style.muted;
  ctx.font = `500 30px ${style.mono}`;
  ctx.fillText(fit(ctx, results.quizTitle, WIDTH - PAD * 2), PAD, 250);

  // The result: the place lit, the field it came from in legal white.
  const won = results.rank === 1 && results.totalParticipants > 1;
  const place = won ? "1st place" : ordinal(results.rank);
  const field = won ? "" : ` of ${results.totalParticipants}`;
  ctx.font = `800 156px ${style.display}`;
  ctx.fontStretch = "condensed";
  ctx.fillStyle = style.accent;
  ctx.fillText(place, PAD - 6, 400);
  const placeWidth = ctx.measureText(place).width;
  ctx.fillStyle = style.foreground;
  ctx.fillText(field, PAD - 6 + placeWidth, 400);
  ctx.fontStretch = "normal";

  // Who, and how: one line in the interface face.
  ctx.fillStyle = style.foreground;
  ctx.font = `600 40px ${style.sans}`;
  const detail = `${results.displayName} · ${results.score} points · ${results.correctCount} of ${scoredCount(results)} right`;
  ctx.fillText(fit(ctx, detail, WIDTH - PAD * 2), PAD, 470);

  // Where it happened.
  ctx.fillStyle = style.border;
  ctx.fillRect(PAD, HEIGHT - PAD - 46, WIDTH - PAD * 2, 2);
  ctx.fillStyle = style.subtle;
  ctx.font = `500 26px ${style.mono}`;
  ctx.fillText(new URL(siteConfig.url).host, PAD, HEIGHT - PAD);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't draw the card.")),
      "image/png",
    ),
  );
}
