import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreDuringBuilds: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
