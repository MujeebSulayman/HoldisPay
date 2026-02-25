import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

const nextConfig: NextConfig = {
  webpack: (config, { dir }) => {
    config.context = fs.realpathSync(path.resolve(dir));
    return config;
  },
};

export default nextConfig;
