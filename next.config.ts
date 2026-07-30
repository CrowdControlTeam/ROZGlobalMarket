import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Prisma no debe bundlearse con el resto del server: OpenNext (Cloudflare)
  // necesita parchear el cliente para que en Workers use el motor WASM en vez
  // del binario nativo. Sin esto, se bundlea el motor "library" nativo, que al
  // arrancar intenta detectar el SO con fs.readdir (no implementado en Workers)
  // y devuelve 500 en cada petición. Ver src/lib/prisma.ts y la guía de
  // OpenNext (https://opennext.js.org/cloudflare/howtos/db).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
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
