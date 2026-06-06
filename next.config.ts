import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Playwright / Chromium out of the bundle — they run only in the Node runtime.
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  images: {
    // Screenshots are served from InsForge Storage public URLs.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
