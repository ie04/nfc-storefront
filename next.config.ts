import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
