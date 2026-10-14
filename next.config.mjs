/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@firecrawl/anydoc"],
  // The Telegram bot reads the company profile from disk on demand (lib/company-profile.ts).
  outputFileTracingIncludes: {
    "/api/telegram": ["./docs/htc-knowledge-base.md"],
  },
  experimental: {
    // Revisiting a page within 30s (e.g. back to the RFP list) renders instantly from the client cache.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
