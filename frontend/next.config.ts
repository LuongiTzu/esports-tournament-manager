import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  experimental: {
    // Compile only the icons used by client and server components.
    optimizePackageImports: [
      "@phosphor-icons/react",
      "@phosphor-icons/react/dist/ssr",
    ],
  },
  images: {
    qualities: [50, 75, 95],
  },
  async headers() {
    return [
      {
        source: "/verify-email",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/confirm-email-change",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
