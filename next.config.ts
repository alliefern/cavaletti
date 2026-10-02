import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // horse photos + stable banners go through server actions
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
