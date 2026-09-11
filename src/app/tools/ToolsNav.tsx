"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Sub-navegación de la sección Tools, estilo pestañas (como DbNav). El pilar
// "Tools" del header marca la sección global. De momento solo la calculadora de
// VCT; el array queda listo para más herramientas.
const TABS = [{ href: "/tools/vct", key: "vct" }] as const;

export function ToolsNav() {
  const pathname = usePathname();
  const t = useTranslations("tools.nav");

  return (
    <div className="mb-6 flex gap-1 border-b-2 border-ro-panel-border">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
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
