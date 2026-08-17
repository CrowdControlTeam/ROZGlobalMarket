"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Sub-navegación de admin (General / Funcionalidades), estilo pestañas como
// DbNav/MyActivityTabs. General es la config del mercado (/admin); Funcionalidades
// (/admin/features) agrupa la config por feature (BiS y las que vengan).
const TABS = [
  // `exact` porque "/admin" es prefijo de "/admin/features": sin esto, General
  // se marcaría activa también estando en Funcionalidades.
  { href: "/admin", key: "general", exact: true },
  { href: "/admin/features", key: "features", exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <div className="mb-6 flex gap-1 border-b-2 border-ro-panel-border">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-0.5 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-ro-accent text-ro-text"
                : "border-transparent text-ro-text-muted hover:text-ro-text"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
