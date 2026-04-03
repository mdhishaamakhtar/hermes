import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0F",
    theme_color: "#2563EB",
    icons: [
      {
        src: siteConfig.iconPath,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
