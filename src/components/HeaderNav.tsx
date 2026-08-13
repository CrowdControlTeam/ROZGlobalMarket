"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Navegación de alto nivel del header: los dos pilares del sitio (Mercado y
// BiS). Es el switch de sección global; la navegación interna del mercado
// (Mi actividad, Estadísticas, Publicar) sigue viviendo en MarketNav, no aquí.
// Todo lo "del mercado" cuelga ya de /market (incluye /market/activity y
// /market/statistics), así que basta ese prefijo para resaltar el pilar.
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function HeaderNav() {
  const pathname = usePathname();
  const t = useTranslations("nav.sections");

  const items = [
    {
      href: "/market",
      label: t("market"),
      active: isUnder(pathname, "/market"),
    },
    { href: "/bis", label: t("bis"), active: isUnder(pathname, "/bis") },
  ];

  return (
    <nav aria-label={t("label")} className="flex items-center gap-3 sm:gap-4">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          // Estilo del mockup del rediseño (.nlink): enlaces de texto sobre la
          // barra navy, sin pill de fondo. Inactivo atenuado (ro-on-navy ~60%);
          // el activo va a full + subrayado de ACENTO (border-b), como en el
          // diseño. El borde transparente en inactivo evita salto de layout.
          className={`border-b-2 pb-0.5 text-sm font-semibold transition-colors ${
            it.active
              ? "border-ro-accent text-ro-on-navy"
              : "border-transparent text-ro-on-navy/60 hover:text-ro-on-navy"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
