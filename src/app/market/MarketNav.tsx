"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Store, User, Gift, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Barra de navegación superior del mercado (el "hub" del diseño): accesos a las
// secciones principales, con la activa resaltada. Publicar es la acción
// destacada (rojo). Sustituye al antiguo <h1> "Mercado".
type NavItem = { href: string; labelKey: string; Icon: LucideIcon; active: boolean; cta?: boolean };

export function MarketNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const type = searchParams.get("type");
  const onMarket = pathname === "/market";
  // Publicar abre el modal interceptado (?publish=<tipo>) sobre el mercado,
  // preservando los filtros actuales; preselecciona el tipo por el que se esté
  // filtrando (Venta por defecto). El acceso directo /market/new sigue siendo la
  // página completa de respaldo.
  const publishParams = new URLSearchParams(searchParams.toString());
  publishParams.set("publish", type || "SALE");
  publishParams.delete("listing");
  const publishHref = `/market?${publishParams.toString()}`;

  const items: NavItem[] = [
    { href: "/market", labelKey: "home.tiles.market.label", Icon: Store, active: onMarket && type !== "GIFT" },
    { href: "/my/listings", labelKey: "nav.account.myActivity", Icon: User, active: pathname.startsWith("/my") },
    { href: "/market?type=GIFT", labelKey: "home.tiles.gifts.label", Icon: Gift, active: onMarket && type === "GIFT" },
    { href: publishHref, labelKey: "home.tiles.publish.label", Icon: Plus, active: false, cta: true },
  ];

  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-bold transition-colors ${
            it.cta
              ? "border-ro-red bg-ro-red text-white hover:opacity-90"
              : it.active
                ? "border-ro-accent bg-ro-accent/10 text-ro-text"
                : "border-ro-panel-border bg-ro-panel text-ro-text hover:border-ro-accent"
          }`}
        >
          <it.Icon size={18} className={it.cta ? "text-white" : "text-ro-accent"} aria-hidden />
          {t(it.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
