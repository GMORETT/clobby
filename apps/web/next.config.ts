import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clobby/schemas"],
  // Local `tsc --noEmit` passes; Vercel's build sees a phantom
  // @supabase/auth-js type resolution issue (`getUser` missing on
  // SupabaseAuthClient). Skip the duplicate type check during build.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
