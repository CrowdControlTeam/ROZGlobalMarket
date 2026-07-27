import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
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
