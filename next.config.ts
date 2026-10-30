import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@carbon/react", "@carbon/icons-react", "@carbon/ibm-products", "@carbon/elements"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
