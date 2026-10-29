import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Finnish pages used to live at the root; keep old links and bookmarks working.
  async redirects() {
    return [
      { source: "/mokit/:id", destination: "/fi/cottages/:id", permanent: true },
      { source: "/omistajille", destination: "/fi/hosts", permanent: true },
    ];
  },
};

export default nextConfig;
