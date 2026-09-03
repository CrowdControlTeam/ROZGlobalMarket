import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) is only used in local dev (docker Postgres, TCP); the
  // production Worker uses Neon's serverless driver (WebSocket) and never takes
  // that branch. It's marked external so it does NOT enter the Worker bundle (it's
  // Node-only and wouldn't work there). See src/db/index.ts.
  //
  // `pg-cloudflare` is an optional dep `pg` requires (pg/lib/stream.js). It ships a
  // real "workerd" export (esm/index.mjs, the Cloudflare socket) and an empty
  // stub for the CJS `require` condition. OpenNext only copies+rewrites to the
  // workerd build the external packages listed here, so without it the build
  // resolves the stub's missing `dist/index.js` and fails. Listing it makes
  // OpenNext use the workerd export. See copyWorkerdPackages in @opennextjs/cloudflare.
  serverExternalPackages: ["pg", "pg-cloudflare"],
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
