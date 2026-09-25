export const siteConfig = {
  name: "Hermes",
  tagline: "Live quizzes, run like a broadcast",
  description:
    "Run live quiz sessions. Put a question on screen and watch answers arrive in real time. Players join from any phone with a six-character code, no account needed.",
  url: "https://hermes.hishaam.dev",
  ogImageAlt: "Hermes: live quizzes, run like a broadcast",
  iconPath: "/icon.svg",
  creator: "Md Hishaam Akhtar",
  keywords: [
    "live quiz",
    "real-time quiz platform",
    "classroom quiz",
    "trivia night",
    "audience polling",
    "join code quiz",
    "Hermes",
  ],
} as const;

function normalizeUrl(value: string) {
  if (!value) return siteConfig.url;
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

export function getSiteUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      siteConfig.url,
  );
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}
