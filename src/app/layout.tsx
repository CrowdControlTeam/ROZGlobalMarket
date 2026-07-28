import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";
import { SiteHeader, SiteHeaderFallback } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} h-full antialiased`}
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
