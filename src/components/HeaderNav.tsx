"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Navegación de alto nivel del header: los dos pilares del sitio (Mercado y
// BiS). Es el switch de sección global; la navegación interna del mercado
// (Mi actividad, Estadísticas, Publicar) sigue viviendo en MarketNav, no aquí.
// Todo lo "del mercado" (/market, /my, /admin/stats) resalta el pilar Mercado.
const MARKET_PREFIXES = ["/market", "/my", "/admin/stats"];

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
      active: MARKET_PREFIXES.some((p) => isUnder(pathname, p)),
    },
    { href: "/bis", label: t("bis"), active: isUnder(pathname, "/bis") },
  ];

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          // Regla del rediseño: los estados activos usan el ACENTO (Azul ROZ),
          // no blanco/gris (rojo = acciones, gold = precios). Sobre la barra
          // navy el texto se mantiene claro (ro-on-navy) por contraste en ambos
          // temas; el activo se marca con tinte de acento, como en MarketNav.
          className={`rounded-md px-2.5 py-1 text-sm font-bold transition-colors ${
            it.active
              ? "bg-ro-accent/20 text-ro-on-navy"
              : "text-ro-on-navy/70 hover:bg-ro-accent/10 hover:text-ro-on-navy"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
