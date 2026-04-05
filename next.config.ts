import { hostname, networkInterfaces } from "node:os";
import type { NextConfig } from "next";

function resolveAllowedDevOrigins() {
  const configuredOrigins = process.env.ALLOWED_DEV_ORIGINS?.trim();

  if (!configuredOrigins) {
    return ["localhost", "127.0.0.1", "::1"];
  }

  if (configuredOrigins !== "*") {
    return configuredOrigins
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const origins = new Set(["localhost", "127.0.0.1", "::1", hostname()]);

  for (const addresses of Object.values(networkInterfaces())) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      if (address.internal) {
        continue;
      }

      origins.add(address.address);
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
