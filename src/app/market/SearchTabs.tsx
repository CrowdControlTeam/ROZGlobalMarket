"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { ItemCategory, ListingType } from "@prisma/client";
import { categoryLabel, listingTypeLabel } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";
import { Toast } from "@/components/Toast";
import { useMarketSearch, type MarketTab } from "./marketSearchStore";
import { countFilters } from "./marketFilterKeys";
import { LupaMenu, TabActionsMenu } from "./SavedSearchMenu";

// Barra de pestañas de "Mis búsquedas" de la sesión. La lógica de estado vive
// en el store (marketSearchStore): aquí solo se pinta y se delega en sus
// acciones. Modelo espacio de trabajo: cada pestaña recuerda su propio objeto
// de filtros. El "+" abre una pestaña nueva y limpia; siempre hay ≥1 pestaña
// (al cerrar la única se resetea). El tipo de listing es un filtro más de cada
// pestaña, por eso esta barra vive por encima del selector de tipo; solo el hub
// superior queda fuera.
//
// Guardar/cargar en DB: la lupa (izquierda) abre el menú de CARGA; el click
// derecho sobre una pestaña abre sus acciones (guardar/renombrar/actualizar/
// borrar). Una pestaña GUARDADA muestra su nombre fijo (no derivado de los
// filtros) y, si sus filtros difieren de lo guardado, un puntito "modificada".

// Geometría de la pestaña activa: se dibuja con un SVG de fondo (relleno panel +
// trazo acento) para poder trazar los flares CÓNCAVOS inferiores que funden la
// pestaña con la línea base — algo que con bordes/pseudo-elementos CSS sale
// frágil (los bordes no hacen curvas cóncavas). Las esquinas van a tamaño fijo
// (no se estira el SVG), así que no se distorsionan: solo el ancho varía según
// el texto, medido con un ResizeObserver.
const TAB_H = 30; // alto de la pestaña
const FLARE = 8; // radio del flare cóncavo inferior
const TOP_R = 8; // radio de las esquinas superiores

function tabPaths(bodyW: number) {
  const w = bodyW + 2 * FLARE; // ancho total del SVG (cuerpo + los dos flares)
  const outline =
    `M0 ${TAB_H}` +
    `A${FLARE} ${FLARE} 0 0 0 ${FLARE} ${TAB_H - FLARE}` + // flare cóncavo izq
    `L${FLARE} ${TOP_R}` + // lado izquierdo
    `A${TOP_R} ${TOP_R} 0 0 1 ${FLARE + TOP_R} 0` + // esquina sup-izq
    `L${w - FLARE - TOP_R} 0` + // borde superior
    `A${TOP_R} ${TOP_R} 0 0 1 ${w - FLARE} ${TOP_R}` + // esquina sup-der
    `L${w - FLARE} ${TAB_H - FLARE}` + // lado derecho
    `A${FLARE} ${FLARE} 0 0 0 ${w} ${TAB_H}`; // flare cóncavo der
  // El relleno cierra por la base (borde inferior); el trazo NO incluye la base
  // (la pestaña queda abierta hacia el contenido, como una pestaña de navegador).
  return { w, fill: `${outline} L0 ${TAB_H} Z`, outline };
}

type MenuState = { tabId: string; x: number; y: number };
type EditState = { tabId: string; mode: "save" | "rename"; value: string };

export function SearchTabs() {
  const t = useTranslations("market");
  const tTabs = useTranslations("market.searchTabs");
  const { tabs, activeId, switchTab, addTab, closeTab, saveTab, renameTab, updateSaved, deleteSaved, isModified } =
    useMarketSearch();
  const activeRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [activeW, setActiveW] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const editingRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  // Mide el ancho del cuerpo de la pestaña activa (cambia con el texto/contador)
  // para dibujar el SVG a tamaño exacto. Se re-observa al cambiar de activa.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const measure = () => setActiveW(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, tabs, edit]);

  // Rueda del ratón → scroll horizontal del carril (sin necesidad de Shift).
  function onWheel(e: React.WheelEvent) {
    const el = railRef.current;
    if (el && e.deltaY !== 0) el.scrollLeft += e.deltaY;
  }

  // Nombre automático derivado de los filtros: término → categoría → tipo; si no
  // hay ninguno (pestaña limpia), "Búsqueda N" por su nº de creación. La
  // categoría (y slot/tipo de arma) es MULTI-VALOR: en el store viaja como CSV,
  // así que se parsea y se etiqueta la primera con "+N" si hay más.
  function derivedLabel(tab: MarketTab): string {
    const f = tab.filters ?? {};
    if (f.q) return f.q;
    const cats = f.category ? f.category.split(",").filter(Boolean) : [];
    if (cats.length > 0) {
      const first = categoryLabel(t, cats[0] as ItemCategory);
      return cats.length > 1 ? `${first} +${cats.length - 1}` : first;
    }
    if (f.type) return listingTypeLabel(t, f.type as ListingType);
    return t("searchTabs.untitled", { n: tab.seq });
  }

  // Una pestaña guardada muestra su nombre FIJO; las demás, el label automático.
  function labelOf(tab: MarketTab): string {
    return tab.name ?? derivedLabel(tab);
  }

  function startEdit(tabId: string, mode: "save" | "rename", value: string) {
    editingRef.current = true;
    setEdit({ tabId, mode, value });
  }
  function cancelEdit() {
    editingRef.current = false;
    setEdit(null);
  }
  function commitEdit() {
    if (!editingRef.current || !edit) return;
    editingRef.current = false;
    const { tabId, mode, value } = edit;
    setEdit(null);
    const name = value.trim();
    if (!name) return;
    (async () => {
      try {
        if (mode === "save") await saveTab(tabId, name);
        else await renameTab(tabId, name);
      } catch (err) {
        setToast(getErrorMessage(err));
      }
    })();
  }

  async function runAction(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      setToast(getErrorMessage(err));
    }
  }

  function openMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault();
    setMenu({ tabId, x: e.clientX, y: e.clientY });
  }

  function tabInner(tab: MarketTab, count: number) {
    if (edit?.tabId === tab.id) {
      return (
        <input
          autoFocus
          value={edit.value}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            else if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          placeholder={tTabs("namePlaceholder")}
          maxLength={60}
          className="w-36 border-b border-ro-accent bg-transparent text-xs text-ro-text placeholder:text-ro-text-muted focus:outline-none"
        />
      );
    }
    return (
      <>
        <button type="button" onClick={() => switchTab(tab.id)} className="flex min-w-0 items-center gap-1">
          <span className="max-w-[12rem] truncate">{labelOf(tab)}</span>
          {count > 0 && <span className="shrink-0 text-ro-text-muted">({count})</span>}
        </button>
        {tab.savedId && isModified(tab) && (
          <span
            aria-hidden
            title={tTabs("modified")}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          />
        )}
        <button
          type="button"
          onClick={() => closeTab(tab.id)}
          title={t("searchTabs.close")}
          aria-label={t("searchTabs.close")}
          className="grid h-4 w-4 shrink-0 place-items-center rounded-sm text-ro-text-muted hover:bg-ro-text/10 hover:text-ro-text"
        >
          <X size={11} />
        </button>
      </>
    );
  }

  const paths = activeW > 0 ? tabPaths(activeW) : null;
  const menuTab = menu ? tabs.find((tb) => tb.id === menu.tabId) : null;

  return (
    // Línea de acento a todo el ancho; la pestaña activa la funde con el
    // contenido mediante los flares cóncavos del SVG. La lupa (menú de carga) y
    // el "+" quedan FIJOS en los extremos; solo el carril de pestañas scrollea.
    <div className="flex items-end gap-1 border-b-2 border-ro-accent">
      <LupaMenu />

      <div
        ref={railRef}
        onWheel={onWheel}
        className="market-tabs-rail flex min-w-0 flex-1 flex-nowrap items-end gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const count = countFilters(tab.filters ?? {});
          if (active) {
            return (
              <div
                key={tab.id}
                ref={activeRef}
                onContextMenu={(e) => openMenu(e, tab.id)}
                // z-10 para que los flares se dibujen por encima de las vecinas;
                // -mb-0.5 para que la base del SVG caiga sobre la línea de acento.
                className="relative z-10 -mb-0.5 flex shrink-0 items-center gap-1 px-2.5 text-xs font-medium text-ro-text"
                style={{ height: TAB_H }}
              >
                {paths && (
                  <svg
                    aria-hidden
                    // El viewBox se extiende 2px por ARRIBA (y el SVG crece 2px)
                    // para que el trazo del borde superior salga completo (si no,
                    // se recortaba a ~1px). Abajo se mantiene el recorte por
                    // defecto, así los flares NO sobresalen bajo la línea base.
                    className="absolute bottom-0 -z-10"
                    style={{ left: -FLARE, width: paths.w, height: TAB_H + 2 }}
                    viewBox={`0 -2 ${paths.w} ${TAB_H + 2}`}
                  >
                    <path d={paths.fill} fill="var(--ro-panel)" />
                    <path
                      d={paths.outline}
                      fill="none"
                      stroke="var(--ro-accent)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {tabInner(tab, count)}
              </div>
            );
          }
          return (
            <div
              key={tab.id}
              onContextMenu={(e) => openMenu(e, tab.id)}
              // Inactiva: apoyada sobre la línea, sin taparla (caja abierta abajo).
              className="flex shrink-0 items-center gap-1 rounded-t-lg border border-b-0 border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-xs text-ro-text-muted transition-colors hover:text-ro-text"
            >
              {tabInner(tab, count)}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addTab}
        title={t("searchTabs.add")}
        aria-label={t("searchTabs.add")}
        className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ro-accent hover:bg-ro-accent/10"
      >
        <Plus size={15} />
      </button>

      {menu && menuTab && (
        <TabActionsMenu
          x={menu.x}
          y={menu.y}
          isSaved={!!menuTab.savedId}
          isModified={isModified(menuTab)}
          onClose={() => setMenu(null)}
          onSave={() => startEdit(menuTab.id, "save", derivedLabel(menuTab))}
          onRename={() => startEdit(menuTab.id, "rename", menuTab.name ?? "")}
          onUpdate={() => runAction(() => updateSaved(menuTab.id))}
          onDelete={() => menuTab.savedId && runAction(() => deleteSaved(menuTab.savedId!))}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
