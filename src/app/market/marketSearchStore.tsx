"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FILTER_KEYS, type Filters } from "./marketFilterKeys";

// Estado central de la búsqueda del mercado. Modelo por PESTAÑA: cada pestaña
// guarda su propio objeto de filtros; la pestaña activa es la FUENTE DE VERDAD.
//
// Flujo (unidireccional tras la carga):
//   - Estado inicial sembrado desde `initialFilters` (que el SERVIDOR extrae de
//     la URL) con un id determinista → SSR y cliente renderizan idéntico (sin
//     desajuste de hidratación).
//   - Después: estado → URL. Cada cambio de filtro actualiza el objeto de la
//     pestaña activa y se serializa a la URL con `router.replace` (debounce),
//     que es lo que dispara la búsqueda en servidor (getListings lee la URL).
//
// Las pestañas viven en memoria durante la sesión (sobreviven a la navegación
// soft; una recarga dura reinicia a una sola pestaña con los filtros de la URL).
// El objeto de filtros es además el sustrato para, más adelante, persistir
// búsquedas por usuario en DB.

export type MarketTab = { id: string; seq: number; filters: Filters };

// Id determinista de la pestaña inicial: debe coincidir en servidor y cliente
// (crypto.randomUUID no serviría, daría valores distintos). Las siguientes
// pestañas se crean en el cliente (manejadores) y sí usan randomUUID.
const INITIAL_TAB_ID = "market-tab-1";

// Solo conserva las claves de filtro conocidas de un objeto de query cualquiera.
function pickFilters(source: Filters): Filters {
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = source[k];
    if (v) f[k] = v;
  }
  return f;
}

// Serializa en orden estable (FILTER_KEYS) para poder comparar por string.
function serialize(filters: Filters): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v) p.set(k, v);
  }
  return p.toString();
}

type MarketSearchContextValue = {
  tabs: MarketTab[];
  activeId: string;
  filters: Filters;
  // Filtros aplicados de la pestaña activa (uno o varios a la vez). Pasar "" o
  // undefined en un valor lo elimina.
  setFilter: (key: string, value: string) => void;
  setFilters: (patch: Record<string, string>) => void;
  switchTab: (id: string) => void;
  addTab: () => void;
  closeTab: (id: string) => void;
  // Bottom-sheet de filtros en móvil: el disparador (icono "Filtros") vive en la
  // cabecera de resultados (MarketResults) y el panel en MarketFilters, así que
  // el estado abierto/cerrado se comparte aquí.
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
};

const MarketSearchContext = createContext<MarketSearchContextValue | null>(null);

export function useMarketSearch(): MarketSearchContextValue {
  const ctx = useContext(MarketSearchContext);
  if (!ctx) throw new Error("useMarketSearch debe usarse dentro de <MarketSearchProvider>");
  return ctx;
}

export function MarketSearchProvider({
  initialFilters,
  children,
}: {
  // Filtros iniciales tomados de la URL POR EL SERVIDOR (MarketPageContent ya
  // parsea searchParams). Se pasan como prop a propósito: llamar a
  // useSearchParams() aquí —el provider envuelve el boundary de la página— opta
  // toda la página a CSR y rompe la hidratación en carga dura.
  initialFilters: Filters;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [tabs, setTabs] = useState<MarketTab[]>(() => [
    { id: INITIAL_TAB_ID, seq: 1, filters: pickFilters(initialFilters) },
  ]);
  const [activeId, setActiveId] = useState<string>(INITIAL_TAB_ID);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Última query que ESTE store empujó a la URL. Se inicializa a lo que ya hay
  // en la URL (initialFilters) para no re-empujar en el montaje. El valor del
  // inicializador de useRef es determinista (mismo en servidor y cliente).
  const lastPushedRef = useRef<string>(serialize(pickFilters(initialFilters)));
  // Id activo por ref para closures estables (setFilter desde manejadores).
  const activeIdRef = useRef<string>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const activeFilters = tabs.find((t) => t.id === activeId)?.filters ?? {};
  const activeStr = serialize(activeFilters);

  // Estado → URL (con debounce, `replace` para no ensuciar el historial). Solo
  // empuja si la query de la pestaña activa difiere de lo último empujado (en el
  // montaje coinciden, así que no hay push inicial).
  useEffect(() => {
    if (activeStr === lastPushedRef.current) return;
    const handle = setTimeout(() => {
      lastPushedRef.current = activeStr;
      router.replace(activeStr ? `${pathname}?${activeStr}` : pathname);
    }, 400);
    return () => clearTimeout(handle);
  }, [activeStr, pathname, router]);

  function applyPatch(filters: Filters, patch: Record<string, string>): Filters {
    const next = { ...filters };
    for (const [k, v] of Object.entries(patch)) {
      if (v) next[k] = v;
      else delete next[k];
    }
    return next;
  }

  function setFilters(patch: Record<string, string>) {
    setTabs((prev) => prev.map((t) => (t.id === activeIdRef.current ? { ...t, filters: applyPatch(t.filters, patch) } : t)));
  }
  function setFilter(key: string, value: string) {
    setFilters({ [key]: value });
  }

  // Navegación inmediata (sin debounce): fija lastPushed y hace replace ya.
  function pushImmediate(filters: Filters) {
    const str = serialize(filters);
    lastPushedRef.current = str;
    router.replace(str ? `${pathname}?${str}` : pathname);
  }

  function switchTab(id: string) {
    if (id === activeId) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    setActiveId(id);
    pushImmediate(tab.filters);
  }

  function addTab() {
    const seq = tabs.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
    const tab: MarketTab = { id: crypto.randomUUID(), seq, filters: {} };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    pushImmediate({});
  }

  function closeTab(id: string) {
    // Última pestaña: se resetea a estado limpio en vez de borrarla (siempre ≥1).
    if (tabs.length === 1) {
      setTabs([{ ...tabs[0], filters: {} }]);
      setActiveId(tabs[0].id);
      pushImmediate({});
      return;
    }
    const idx = tabs.findIndex((x) => x.id === id);
    const next = tabs.filter((x) => x.id !== id);
    setTabs(next);
    if (id === activeId) {
      const neighbor = next[Math.max(0, idx - 1)];
      setActiveId(neighbor.id);
      pushImmediate(neighbor.filters);
    }
  }

  const value: MarketSearchContextValue = {
    tabs,
    activeId,
    filters: activeFilters,
    setFilter,
    setFilters,
    switchTab,
    addTab,
    closeTab,
    mobileFiltersOpen,
    setMobileFiltersOpen,
  };

  return <MarketSearchContext.Provider value={value}>{children}</MarketSearchContext.Provider>;
}
