import type { NextConfig } from "next";

// The owner dashboard talks to Django through this site's own /api path, so the
// sign-in cookie belongs to the site and no cross-origin cookies are needed.
const API_URL = process.env.API_URL ?? "http://localhost:8100";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Django's URLs end in "/"; keep them as they are instead of redirecting.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Keep the trailing slash Django expects (Next drops it from :path* otherwise).
      { source: "/api/:path*/", destination: `${API_URL}/api/:path*/` },
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
