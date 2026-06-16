import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/fos",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
