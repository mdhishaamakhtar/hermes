import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  /*
   * The OG routes read their fonts with fs at request time, so nothing
   * imports lib/og-fonts and tracing would otherwise leave the files out of
   * the standalone bundle.
   */
  outputFileTracingIncludes: {
    "/opengraph-image": ["./lib/og-fonts/**"],
    "/twitter-image": ["./lib/og-fonts/**"],
  },
};

export default nextConfig;
