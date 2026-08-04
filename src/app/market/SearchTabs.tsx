"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, X } from "lucide-react";

// Pestañas de "Mis búsquedas" de la SESIÓN. Cada pestaña es un snapshot de la
// query completa (tipo + filtros + orden + búsqueda por nombre); el tipo de
// listing forma parte del contexto de cada búsqueda, por eso la barra vive por
// ENCIMA del selector de tipo. El hub superior (MarketNav) queda fuera.
//
// Como los filtros aplican al vuelo, las búsquedas NO se crean solas: se pulsa
// "+" para guardar la actual. La pestaña activa es aquella cuyo snapshot
// coincide con la query actual; si no coincide ninguna, no hay activa (estado
// ad-hoc) y "+" la guarda.

type SavedSearch = { id: string; name: string; query: string };

const STORAGE_KEY = "roz.market.searches";

// Firma canónica de una query para comparar búsquedas: se ignora el overlay de
// detalle (`listing`), se descartan valores vacíos y se ordenan las claves.
function canonical(query: string): string {
  const p = new URLSearchParams(query);
  p.delete("listing");
  const entries = [...p.entries()].filter(([, v]) => v !== "");
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

export function SearchTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");

  // Estado de sesión: se hidrata desde sessionStorage tras montar (evita
  // desajuste de hidratación y sobrevive a recargas dentro de la sesión).
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSearch[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setSearches(parsed);
      }
    } catch {
      // sessionStorage no disponible o JSON corrupto: se arranca sin búsquedas.
    }
  }, []);
  function persist(next: SavedSearch[]) {
    setSearches(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignoramos fallos de sessionStorage (modo privado, cuota, etc.).
    }
  }

  const currentCanon = canonical(searchParams.toString());
  const activeId = searches.find((s) => canonical(s.query) === currentCanon)?.id ?? null;

  // Nombre corto y legible derivado de la propia búsqueda: prioriza el término
  // de búsqueda, luego categoría, luego tipo; si no hay nada, "Búsqueda N".
  function deriveName(query: string): string {
    const p = new URLSearchParams(query);
    const q = p.get("q");
    if (q) return q;
    const category = p.get("category");
    if (category) return t(`catalog.category.${category}`);
    const type = p.get("type");
    if (type) return t(`listing.type.${type}`);
    const n = searches.filter((s) => /^.*\d+$/.test(s.name)).length + 1;
    return t("searchTabs.untitled", { n });
  }

  function saveCurrent() {
    // Ya guardada (coincide con una pestaña): no duplicar.
    if (activeId) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("listing");
    const query = p.toString();
    const saved: SavedSearch = { id: crypto.randomUUID(), name: deriveName(query), query };
    persist([...searches, saved]);
  }

  function selectSearch(s: SavedSearch) {
    router.push(`${pathname}?${s.query}`);
  }

  function removeSearch(id: string) {
    persist(searches.filter((s) => s.id !== id));
  }

  return (
    // Línea de acento a todo el ancho; la pestaña activa "conecta" con el
    // contenido cubriendo esa línea (margen inferior negativo + borde inferior
    // del color del panel).
    <div className="flex flex-wrap items-end gap-1 border-b-2 border-ro-accent">
      <span
        aria-hidden
        title={t("searchTabs.indicator")}
        className="flex h-7 items-center px-1.5 text-ro-text-muted"
      >
        <Search size={13} />
      </span>

      {searches.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            className={`-mb-0.5 flex items-center gap-1 rounded-t-lg border border-b-2 px-2.5 py-1.5 text-xs ${
              active
                ? "border-ro-accent border-b-ro-panel bg-ro-panel font-medium text-ro-text"
                : "border-ro-panel-border border-b-transparent bg-ro-panel-alt text-ro-text-muted hover:text-ro-text"
            }`}
          >
            <button type="button" onClick={() => selectSearch(s)} className="max-w-[12rem] truncate">
              {s.name}
            </button>
            <button
              type="button"
              onClick={() => removeSearch(s.id)}
              title={t("searchTabs.close")}
              aria-label={t("searchTabs.close")}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-sm text-ro-text-muted hover:bg-ro-text/10 hover:text-ro-text"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={saveCurrent}
        disabled={activeId !== null}
        title={t("searchTabs.save")}
        aria-label={t("searchTabs.save")}
        className="mb-0.5 grid h-7 w-7 place-items-center rounded-lg text-ro-accent hover:bg-ro-accent/10 disabled:cursor-default disabled:text-ro-text-muted/50 disabled:hover:bg-transparent"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
