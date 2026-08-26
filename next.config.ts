import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) is only used in local dev (docker Postgres, TCP); the
  // production Worker uses Neon's serverless driver (WebSocket) and never takes
  // that branch. It's marked external so it does NOT enter the Worker bundle (it's
  // Node-only and wouldn't work there). See src/db/index.ts.
  serverExternalPackages: ["pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/avatars/**",
      },
    ],
  },
  experimental: {
    // Tope del body de las server actions. El único envío grande es la
    // captura del reconocimiento por IA (ver MAX_SCREENSHOT_MB en
    // src/lib/screenshot-constants.ts); el resto son formularios pequeños.
    // El defecto de Next es 1 MB, insuficiente para algunas capturas.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
