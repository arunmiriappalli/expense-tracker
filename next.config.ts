import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {},
  allowedDevOrigins: ["192.168.0.2"],
};

export default nextConfig;
