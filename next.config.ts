import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // `pg` (node-postgres) solo se usa en dev local (Postgres de docker, TCP); en
  // el Worker de producción se usa el driver serverless de Neon (WebSocket) y esa
  // rama nunca se ejecuta. Se marca como external para que NO entre en el bundle
  // del Worker (es Node-only y no funcionaría ahí). Ver src/db/index.ts.
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
