import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/fire",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
