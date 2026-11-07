import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// A static site: `npm run build` writes out/, which Cloudflare serves as it is (wrangler.jsonc, public/_headers).
export default function nextConfig(phase: string): NextConfig {
  return {
    reactStrictMode: true,
    output: "export",
    // An export always builds in .next, and takes any other distDir as where to write the site. So `next dev` moves
    // out of the way instead, into a folder git already ignores, and a build can run beside a live dev server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-verify" : ".next",
  };
}
