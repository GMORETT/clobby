import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clobby/schemas"],
};

export default nextConfig;
