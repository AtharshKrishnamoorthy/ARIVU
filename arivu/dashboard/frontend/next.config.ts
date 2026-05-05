import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Treat <img> warnings as warnings not errors — logo files are served locally
    ignoreDuringBuilds: false,
  },
  images: {
    // Allow unoptimized SVG/PNG logos served from public/
    unoptimized: true,
  },
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
