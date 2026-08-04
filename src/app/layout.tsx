import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";
import { SiteHeader, SiteHeaderFallback } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// Fuente de cuerpo: intercambiable Geist ⇄ Poppins con una sola línea (ver
// `bodyFont` más abajo). Ambas exponen la misma variable CSS --font-body, y
// solo la activa se añade al className del <html>, así que únicamente esa se
// descarga. globals.css mapea --font-sans → var(--font-body).
const geistSans = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Fuente de cuerpo activa. ← Cambia `.geist` por `.poppins` para probar
// Poppins (ambas se referencian aquí, así no hay variable sin usar).
const bodyFont = { geist: geistSans, poppins }.geist;

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fuente de título/logo (--font-heading): Pixeloid Sans (la que usa la web
// oficial de ROZ), auto-alojada. Licencia SIL Open Font License 1.1 — ver
// src/app/fonts/License.txt (debe acompañar a la fuente). Sustituye a la
// antigua Press Start 2P. El logo usa la variante bold (weight 700).
const pixeloid = localFont({
  variable: "--font-heading",
  src: [
    { path: "./fonts/PixeloidSans.ttf", weight: "400", style: "normal" },
    { path: "./fonts/PixeloidSans-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await loadMarketConfig();
  const t = await getTranslations("market");
  return {
    title: siteName,
    description: t("metaDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = await getLocale();
  // Tema resuelto en servidor desde la cookie (sin parpadeo). Por defecto
  // oscuro cuando no hay preferencia guardada; el usuario lo cambia con el
  // toggle de la cabecera, que actualiza el atributo y la cookie.
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${bodyFont.variable} ${geistMono.variable} ${pixeloid.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Suspense fallback={<SiteHeaderFallback />}>
            <SiteHeader user={session?.user ?? null} theme={theme} />
          </Suspense>
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
