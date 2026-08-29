import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
