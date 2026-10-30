import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentUpgrade: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@carbon/react", "@carbon/icons-react", "@carbon/ibm-products", "@carbon/elements"],
};

export default nextConfig;
