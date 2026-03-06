import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  webpack: (config, { dir }) => {
    config.context = fs.realpathSync(path.resolve(dir));
    return config;
  },
  turbopack: {},
};

export default nextConfig;
