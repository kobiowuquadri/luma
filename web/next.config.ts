import type { NextConfig } from "next";

/**
 * The LUMA website is a static export: plain HTML, CSS and a little JS that
 * any static host can serve (Render static site, Netlify, GitHub Pages...).
 * The APK itself is hosted wherever the team publishes releases; its URL
 * and details live in src/content/release.json.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
