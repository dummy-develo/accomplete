import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN IPs allowed to load dev-only resources (HMR, etc.) so the app can be
  // tested from a phone on the same network. Dev-only; ignored in production.
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGIN
      ? [process.env.DEV_ALLOWED_ORIGIN]
      : [],

};

export default nextConfig;
