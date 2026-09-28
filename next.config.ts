import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required for `forbidden()` (used by requirePagePermission in lib/rbac.ts)
    // to render app/forbidden.tsx instead of throwing.
    authInterrupts: true,
  },
};

export default nextConfig;
