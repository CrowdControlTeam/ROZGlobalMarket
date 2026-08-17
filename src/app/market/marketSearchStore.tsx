"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FILTER_KEYS, NEW_TAB_PARAM, parseFilters, type Filters } from "./marketFilterKeys";
import {
  createSavedSearch,
  renameSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  type SavedSearchDTO,
} from "@/lib/saved-searches";

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

// `savedId`/`name` solo están presentes cuando la pestaña está GUARDADA en DB
// (ver saved-searches). El nombre de una guardada es fijo (no se re-deriva de
// los filtros); las no guardadas usan el label automático.
export type MarketTab = { id: string; seq: number; filters: Filters; savedId?: string; name?: string };

// Id determinista de la pestaña inicial: debe coincidir en servidor y cliente
// (crypto.randomUUID no serviría, daría valores distintos). Las siguientes
// pestañas se crean en el cliente (manejadores) y sí usan randomUUID.
const INITIAL_TAB_ID = "market-tab-1";

// El workspace de pestañas se persiste en sessionStorage para sobrevivir a la
// navegación entre secciones (el provider vive dentro de la página del mercado y
// se desmonta al salir). Alimenta sobre todo el flujo "abrir en pestaña nueva"
// desde BiS: al volver al mercado con NEW_TAB_PARAM, se recupera lo que hubiera y
// se le añade una pestaña más.
const WORKSPACE_KEY = "market-workspace";

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

// Filtros "discretos": se fijan con un clic/selección, no escribiendo. Aplican
// al instante (así el skeleton sale desde el primer momento). El resto —texto
// libre: buscador `q`, precio, refino, slots, valores de opción— va con debounce
// para no navegar en cada tecla. `posterName` acompaña a `posterId` (mismo gesto
// del UserPicker).
const DISCRETE_KEYS = new Set<string>([
  "type",
  "sort",
  "category",
  "slot",
  "weaponType",
  "posterId",
  "posterName",
]);

// Claves cuyo valor difiere entre dos conjuntos de filtros.
function changedKeys(a: Filters, b: Filters): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] !== b[k]) out.push(k);
  }
  return out;
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
  // Búsquedas guardadas del usuario (DB) y acciones sobre ellas. Guardar /
  // renombrar / actualizar / borrar operan sobre la propia pestaña; cargar abre
  // pestañas nuevas (no destructivo). Ver saved-searches.ts.
  savedSearches: SavedSearchDTO[];
  openSaved: (s: SavedSearchDTO) => void;
  openAllSaved: () => void;
  saveTab: (tabId: string, name: string) => Promise<void>;
  renameTab: (tabId: string, name: string) => Promise<void>;
  updateSaved: (tabId: string) => Promise<void>;
  deleteSaved: (savedId: string) => Promise<void>;
  // ¿Los filtros de una pestaña guardada difieren de lo persistido en DB?
  isModified: (tab: MarketTab) => boolean;
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
  initialSavedSearches,
  children,
}: {
  // Filtros iniciales tomados de la URL POR EL SERVIDOR (MarketPageContent ya
  // parsea searchParams). Se pasan como prop a propósito: llamar a
  // useSearchParams() aquí —el provider envuelve el boundary de la página— opta
  // toda la página a CSR y rompe la hidratación en carga dura.
  initialFilters: Filters;
  // Búsquedas guardadas del usuario, cargadas en el servidor (MarketPageContent).
  initialSavedSearches: SavedSearchDTO[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [tabs, setTabs] = useState<MarketTab[]>(() => [
    { id: INITIAL_TAB_ID, seq: 1, filters: pickFilters(initialFilters) },
  ]);
  const [activeId, setActiveId] = useState<string>(INITIAL_TAB_ID);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearchDTO[]>(initialSavedSearches);

  // Última query que ESTE store empujó a la URL. Se inicializa a lo que ya hay
  // en la URL (initialFilters) para no re-empujar en el montaje. El valor del
  // inicializador de useRef es determinista (mismo en servidor y cliente).
  const lastPushedRef = useRef<string>(serialize(pickFilters(initialFilters)));
  // Objeto (no solo string) de lo último empujado, para saber QUÉ claves
  // cambiaron y decidir inmediato vs debounce.
  const lastPushedFiltersRef = useRef<Filters>(pickFilters(initialFilters));
  // Id activo por ref para closures estables (setFilter desde manejadores).
  const activeIdRef = useRef<string>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Restauración / "pestaña nueva" — UNA sola vez al montar (post-hidratación,
  // así SSR y primer render siguen siendo la pestaña sembrada desde la URL). Si
  // la URL trae NEW_TAB_PARAM (viene de BiS), se recupera el workspace guardado y
  // se le AÑADE una pestaña con los filtros de la URL (activa), sin pisar lo que
  // hubiera; luego se limpia el param. En carga normal NO se restaura: se respeta
  // el comportamiento actual (una pestaña desde la URL); la persistencia de abajo
  // solo alimenta este flujo. Declarado ANTES del efecto de persistencia para
  // leer sessionStorage antes de que aquél lo sobrescriba.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (new URLSearchParams(window.location.search).get(NEW_TAB_PARAM) !== "1") return;

    let restored: MarketTab[] = [];
    try {
      const raw = sessionStorage.getItem(WORKSPACE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed?.tabs)) restored = parsed.tabs as MarketTab[];
    } catch {
      // sessionStorage no disponible (modo privado) o JSON corrupto: se ignora.
    }

    const itemFilters = pickFilters(initialFilters);
    const seq = restored.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
    const newTab: MarketTab = { id: crypto.randomUUID(), seq, filters: itemFilters };
    // setState en el montaje a propósito: la restauración/append debe ocurrir
    // tras hidratar (el primer render se siembra determinista desde la URL para
    // no romper la hidratación), así que aquí se reajustan las pestañas.
    /* eslint-disable react-hooks/set-state-in-effect */
    setTabs([...restored, newTab]);
    setActiveId(newTab.id);
    /* eslint-enable react-hooks/set-state-in-effect */

    // La activa (newTab) ya coincide con los filtros de la URL, así que no hay
    // que re-navegar: solo se quita NEW_TAB_PARAM de la URL (si no, un refresh
    // volvería a duplicar la pestaña).
    const clean = serialize(itemFilters);
    lastPushedRef.current = clean;
    lastPushedFiltersRef.current = itemFilters;
    router.replace(clean ? `${pathname}?${clean}` : pathname);
  }, [initialFilters, pathname, router]);

  // Persistencia del workspace en sessionStorage (en cada cambio de pestañas o de
  // activa). Es lo que permite que "lo que haya" sobreviva a la navegación para
  // el flujo de arriba.
  useEffect(() => {
    try {
      sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify({ tabs, activeId }));
    } catch {
      // Cuota / modo privado: la persistencia es best-effort.
    }
  }, [tabs, activeId]);

  const activeFilters = useMemo(
    () => tabs.find((t) => t.id === activeId)?.filters ?? {},
    [tabs, activeId],
  );
  const activeStr = serialize(activeFilters);

  // Estado → URL (`replace` para no ensuciar el historial). Solo empuja si la
  // query de la pestaña activa difiere de lo último empujado (en el montaje
  // coinciden, así que no hay push inicial). Filtros DISCRETOS (clic/selección)
  // → inmediato, para que el skeleton salga desde el primer momento; campos de
  // TEXTO (q, precio, refino, slots…) → debounce, para no navegar en cada tecla.
  useEffect(() => {
    if (activeStr === lastPushedRef.current) return;
    const changed = changedKeys(lastPushedFiltersRef.current, activeFilters);
    const allDiscrete = changed.length > 0 && changed.every((k) => DISCRETE_KEYS.has(k));
    const handle = setTimeout(() => {
      lastPushedRef.current = activeStr;
      lastPushedFiltersRef.current = activeFilters;
      router.replace(activeStr ? `${pathname}?${activeStr}` : pathname);
    }, allDiscrete ? 0 : 400);
    return () => clearTimeout(handle);
  }, [activeStr, activeFilters, pathname, router]);

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
    lastPushedFiltersRef.current = filters;
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

  // Abre una búsqueda guardada en una pestaña NUEVA (no destructivo), vinculada
  // a su id para poder renombrar/actualizar/borrar después.
  function openSaved(s: SavedSearchDTO) {
    const filters = parseFilters(s.filters);
    const seq = tabs.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
    const tab: MarketTab = { id: crypto.randomUUID(), seq, filters, savedId: s.id, name: s.name };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    pushImmediate(filters);
  }

  // Abre TODAS las guardadas, una pestaña por cada una (append); activa la 1ª.
  function openAllSaved() {
    if (savedSearches.length === 0) return;
    let seq = tabs.reduce((m, x) => Math.max(m, x.seq), 0);
    const newTabs: MarketTab[] = savedSearches.map((s) => ({
      id: crypto.randomUUID(),
      seq: ++seq,
      filters: parseFilters(s.filters),
      savedId: s.id,
      name: s.name,
    }));
    setTabs((prev) => [...prev, ...newTabs]);
    setActiveId(newTabs[0].id);
    pushImmediate(newTabs[0].filters);
  }

  // Guarda los filtros de una pestaña como búsqueda nueva y la vincula.
  async function saveTab(tabId: string, name: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const dto = await createSavedSearch(name, serialize(tab.filters));
    setSavedSearches((prev) => [...prev, dto]);
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, savedId: dto.id, name: dto.name } : t)));
  }

  // Renombra: solo tiene sentido en una pestaña guardada (persiste en DB).
  async function renameTab(tabId: string, name: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.savedId) return;
    const trimmed = name.trim();
    await renameSavedSearch(tab.savedId, trimmed);
    setSavedSearches((prev) => prev.map((s) => (s.id === tab.savedId ? { ...s, name: trimmed } : s)));
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: trimmed } : t)));
  }

  // Persiste los filtros actuales de una pestaña guardada modificada (baseline).
  async function updateSaved(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.savedId) return;
    const filters = serialize(tab.filters);
    await updateSavedSearch(tab.savedId, filters);
    setSavedSearches((prev) => prev.map((s) => (s.id === tab.savedId ? { ...s, filters } : s)));
  }

  // Borra de la DB. La(s) pestaña(s) abierta(s) con ese id se DESVINCULAN (pierden
  // savedId/name → vuelven a label automático), pero NO se cierran.
  async function deleteSaved(savedId: string) {
    await deleteSavedSearch(savedId);
    setSavedSearches((prev) => prev.filter((s) => s.id !== savedId));
    setTabs((prev) =>
      prev.map((t) => (t.savedId === savedId ? { ...t, savedId: undefined, name: undefined } : t)),
    );
  }

  function isModified(tab: MarketTab): boolean {
    if (!tab.savedId) return false;
    const saved = savedSearches.find((s) => s.id === tab.savedId);
    return !!saved && serialize(tab.filters) !== saved.filters;
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
    savedSearches,
    openSaved,
    openAllSaved,
    saveTab,
    renameTab,
    updateSaved,
    deleteSaved,
    isModified,
    mobileFiltersOpen,
    setMobileFiltersOpen,
  };

  return <MarketSearchContext.Provider value={value}>{children}</MarketSearchContext.Provider>;
}
