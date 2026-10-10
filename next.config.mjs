/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@firecrawl/anydoc"],
  experimental: {
    // Revisiting a page within 30s (e.g. back to the RFP list) renders instantly from the client cache.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
