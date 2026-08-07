"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, X } from "lucide-react";
import { useMarketSearch, type MarketTab } from "./marketSearchStore";
import { countFilters } from "./marketFilterKeys";

// Barra de pestañas de "Mis búsquedas" de la sesión. La lógica de estado vive
// en el store (marketSearchStore): aquí solo se pinta y se delega en sus
// acciones. Modelo espacio de trabajo: cada pestaña recuerda su propio objeto
// de filtros. El "+" abre una pestaña nueva y limpia; siempre hay ≥1 pestaña
// (al cerrar la única se resetea). El tipo de listing es un filtro más de cada
// pestaña, por eso esta barra vive por encima del selector de tipo; solo el hub
// superior queda fuera.

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

export function SearchTabs() {
  const t = useTranslations("market");
  const { tabs, activeId, switchTab, addTab, closeTab } = useMarketSearch();
  const activeRef = useRef<HTMLDivElement>(null);
  const [activeW, setActiveW] = useState(0);

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
  }, [activeId, tabs]);

  // Nombre corto derivado de los filtros de la pestaña: término → categoría →
  // tipo; si no hay ninguno (pestaña limpia), "Búsqueda N" por su nº de creación.
  function labelOf(tab: MarketTab): string {
    const f = tab.filters ?? {};
    if (f.q) return f.q;
    if (f.category) return t(`catalog.category.${f.category}`);
    if (f.type) return t(`listing.type.${f.type}`);
    return t("searchTabs.untitled", { n: tab.seq });
  }

  function tabInner(tab: MarketTab, count: number) {
    return (
      <>
        <button
          type="button"
          onClick={() => switchTab(tab.id)}
          className="flex min-w-0 items-center gap-1"
        >
          <span className="max-w-[12rem] truncate">{labelOf(tab)}</span>
          {count > 0 && <span className="shrink-0 text-ro-text-muted">({count})</span>}
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
      </>
    );
  }

  const paths = activeW > 0 ? tabPaths(activeW) : null;

  return (
    // Línea de acento a todo el ancho; la pestaña activa la funde con el
    // contenido mediante los flares cóncavos del SVG.
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
        const count = countFilters(tab.filters ?? {});
        if (active) {
          return (
            <div
              key={tab.id}
              ref={activeRef}
              // z-10 para que los flares se dibujen por encima de las vecinas;
              // -mb-0.5 para que la base del SVG caiga sobre la línea de acento.
              className="relative z-10 -mb-0.5 flex items-center gap-1 px-2.5 text-xs font-medium text-ro-text"
              style={{ height: TAB_H }}
            >
              {paths && (
                <svg
                  aria-hidden
                  className="absolute bottom-0 -z-10"
                  style={{ left: -FLARE, width: paths.w, height: TAB_H }}
                  viewBox={`0 0 ${paths.w} ${TAB_H}`}
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
            // Inactiva: apoyada sobre la línea, sin taparla (caja abierta abajo).
            className="flex items-center gap-1 rounded-t-lg border border-b-0 border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-xs text-ro-text-muted transition-colors hover:text-ro-text"
          >
            {tabInner(tab, count)}
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
