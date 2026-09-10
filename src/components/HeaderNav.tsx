"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

// Navegación de alto nivel del header: los pilares del sitio (Mercado, Builds,
// DB). Es el switch de sección global; la navegación interna del mercado
// (Mi actividad, Estadísticas, Publicar) sigue viviendo en MarketNav, no aquí.
// Las secciones con pestañas (Builds, DB) llevan una flecha que despliega sus
// pestañas para ir directo a ellas (la etiqueta sigue navegando a la sección).
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type SubTab = { href: string; label: string };

export function HeaderNav() {
  const pathname = usePathname();
  const t = useTranslations("nav.sections");
  const tBuilds = useTranslations("builds.tabs");
  const tDb = useTranslations("db.nav");
  // Qué desplegable está abierto (por key), o null.
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sections: { key: string; href: string; label: string; active: boolean; subtabs?: SubTab[] }[] = [
    { key: "market", href: "/market", label: t("market"), active: isUnder(pathname, "/market") },
    {
      key: "builds",
      href: "/builds",
      label: t("builds"),
      active: isUnder(pathname, "/builds"),
      subtabs: [
        { href: "/builds", label: tBuilds("all") },
        { href: "/builds?tab=mine", label: tBuilds("mine") },
      ],
    },
    {
      key: "db",
      href: "/db",
      label: t("db"),
      active: isUnder(pathname, "/db"),
      subtabs: [
        { href: "/db/items", label: tDb("items") },
        { href: "/db/skills", label: tDb("skills") },
      ],
    },
  ];

  return (
    <nav ref={navRef} aria-label={t("label")} className="flex items-center gap-3 sm:gap-4">
      {sections.map((s) => (
        <div key={s.key} className="relative flex items-center">
          <Link
            href={s.href}
            aria-current={s.active ? "page" : undefined}
            onClick={() => setOpen(null)}
            // Estilo del mockup del rediseño (.nlink): enlaces de texto sobre la
            // barra navy, sin pill de fondo. Inactivo atenuado; activo full +
            // subrayado de acento. El borde transparente evita salto de layout.
            className={`border-b-2 pb-0.5 text-sm font-semibold transition-colors ${
              s.active
                ? "border-ro-accent text-ro-on-navy"
                : "border-transparent text-ro-on-navy/60 hover:text-ro-on-navy"
            }`}
          >
            {s.label}
          </Link>
          {s.subtabs && (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open === s.key}
              aria-label={t("expand", { section: s.label })}
              onClick={() => setOpen((cur) => (cur === s.key ? null : s.key))}
              className="ml-0.5 grid h-5 w-5 place-items-center rounded text-ro-on-navy/60 transition-colors hover:text-ro-on-navy"
            >
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform ${open === s.key ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {s.subtabs && open === s.key && (
            <div
              role="menu"
              className="absolute left-0 top-full z-40 mt-2 min-w-40 overflow-hidden rounded-md border-2 border-ro-panel-border bg-ro-panel py-1 shadow-xl"
            >
              {s.subtabs.map((st) => (
                <Link
                  key={st.href}
                  role="menuitem"
                  href={st.href}
                  onClick={() => setOpen(null)}
                  className="block px-3 py-1.5 text-sm text-ro-text transition-colors hover:bg-ro-accent/15"
                >
                  {st.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
