"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, X } from "lucide-react";

// Pestañas de "Mis búsquedas" de la SESIÓN, modelo ESPACIO DE TRABAJO: cada
// pestaña recuerda SU propio conjunto de filtros. Al cambiar cualquier filtro
// (tipo, filtros del panel, orden, búsqueda por nombre) se actualiza en vivo la
// pestaña activa —ni más ni menos—. Cambiar de pestaña restaura sus filtros.
//
// El tipo de listing forma parte del contexto de cada pestaña, por eso la barra
// vive por ENCIMA del selector de tipo; solo el hub superior queda fuera.
//
// Reglas: "+" abre una pestaña NUEVA y LIMPIA (sin filtros). Siempre hay ≥1
// pestaña; al cerrar la única, se resetea a estado limpio en vez de borrarla.

type Tab = { id: string; seq: number; query: string };

const STORAGE_KEY = "roz.market.tabs";

// La query que define una pestaña: todo salvo el overlay de detalle (`listing`).
function queryOf(sp: { toString: () => string }): string {
  const p = new URLSearchParams(sp.toString());
  p.delete("listing");
  return p.toString();
}

export function SearchTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // El efecto de sincronización lee el id activo por ref para no reejecutarse al
  // cambiar de pestaña (evita pisar la query de la nueva con la de la anterior).
  // El ref se mantiene al día desde un efecto (no se puede mutar en render).
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  function hrefOf(query: string): string {
    return query ? `${pathname}?${query}` : pathname;
  }

  // Hidratación (una vez): restaura de sessionStorage o crea la pestaña inicial
  // adoptando los filtros que traiga la URL. Se hace tras montar para no romper
  // la hidratación de React.
  useEffect(() => {
    let restored: { tabs: Tab[]; activeId: string | null } | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch {
      // sessionStorage no disponible o JSON corrupto: se arranca de cero.
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restored && Array.isArray(restored.tabs) && restored.tabs.length > 0) {
      setTabs(restored.tabs);
      setActiveId(restored.tabs.some((x) => x.id === restored!.activeId) ? restored.activeId : restored.tabs[0].id);
    } else {
      const tab: Tab = { id: crypto.randomUUID(), seq: 1, query: queryOf(searchParams) };
      setTabs([tab]);
      setActiveId(tab.id);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Solo al montar: la URL inicial se captura una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza la URL (filtros en vivo) hacia la pestaña activa. Se dispara solo
  // al cambiar `searchParams`; al cambiar de pestaña no corre (id por ref), así
  // que el push de esa navegación es quien actualiza la URL y luego este efecto
  // reescribe —idempotente— la misma query en la pestaña ya activa.
  useEffect(() => {
    if (!hydrated) return;
    const query = queryOf(searchParams);
    setTabs((prev) => {
      const active = prev.find((x) => x.id === activeIdRef.current);
      if (!active || active.query === query) return prev;
      return prev.map((x) => (x.id === activeIdRef.current ? { ...x, query } : x));
    });
  }, [searchParams, hydrated]);

  // Persistencia de sesión.
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
    } catch {
      // Ignoramos fallos de sessionStorage (modo privado, cuota, etc.).
    }
  }, [tabs, activeId, hydrated]);

  // Nombre corto derivado de los filtros de la pestaña: término → categoría →
  // tipo; si no hay ninguno (pestaña limpia), "Búsqueda N" por su nº de creación.
  function labelOf(tab: Tab): string {
    const p = new URLSearchParams(tab.query);
    const q = p.get("q");
    if (q) return q;
    const category = p.get("category");
    if (category) return t(`catalog.category.${category}`);
    const type = p.get("type");
    if (type) return t(`listing.type.${type}`);
    return t("searchTabs.untitled", { n: tab.seq });
  }

  function selectTab(tab: Tab) {
    if (tab.id === activeId) return;
    setActiveId(tab.id);
    router.push(hrefOf(tab.query));
  }

  function addTab() {
    const seq = tabs.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
    const tab: Tab = { id: crypto.randomUUID(), seq, query: "" };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    router.push(pathname);
  }

  function closeTab(id: string) {
    // Última pestaña: se resetea a estado limpio en vez de borrarla (siempre ≥1).
    if (tabs.length === 1) {
      const reset: Tab = { ...tabs[0], query: "" };
      setTabs([reset]);
      setActiveId(reset.id);
      router.push(pathname);
      return;
    }
    const idx = tabs.findIndex((x) => x.id === id);
    const next = tabs.filter((x) => x.id !== id);
    setTabs(next);
    if (id === activeId) {
      const neighbor = next[Math.max(0, idx - 1)];
      setActiveId(neighbor.id);
      router.push(hrefOf(neighbor.query));
    }
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

      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={`-mb-0.5 flex items-center gap-1 rounded-t-lg border border-b-2 px-2.5 py-1.5 text-xs ${
              active
                ? "border-ro-accent border-b-ro-panel bg-ro-panel font-medium text-ro-text"
                : "border-ro-panel-border border-b-transparent bg-ro-panel-alt text-ro-text-muted hover:text-ro-text"
            }`}
          >
            <button type="button" onClick={() => selectTab(tab)} className="max-w-[12rem] truncate">
              {labelOf(tab)}
            </button>
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
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
        onClick={addTab}
        title={t("searchTabs.add")}
        aria-label={t("searchTabs.add")}
        className="mb-0.5 grid h-7 w-7 place-items-center rounded-lg text-ro-accent hover:bg-ro-accent/10"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
