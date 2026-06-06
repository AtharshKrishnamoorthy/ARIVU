import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run as a separate CI step — don't block the production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript errors are caught in CI — don't block the production build
    ignoreBuildErrors: true,
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
          destination: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
