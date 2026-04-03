export const siteConfig = {
  name: "Hermes",
  title: "Hermes",
  description:
    "Real-time quiz sessions with live analytics, organiser controls, and seamless participant joins.",
  shortDescription:
    "Real-time quiz sessions. Live analytics. Anonymous participants.",
  url: "https://hermes.hishaam.dev",
  ogImagePath: "/og-image.svg",
  ogImageAlt: "Hermes preview card",
  iconPath: "/icon.svg",
  creator: "Md Hishaam Akhtar",
  keywords: [
    "real-time quiz platform",
    "live quiz app",
    "polling platform",
    "quiz host dashboard",
    "websocket quiz app",
    "anonymous participant quiz",
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
