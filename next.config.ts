import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from inferring a higher-level workspace root when multiple
  // lockfiles exist on the machine (common on Windows dev boxes).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
