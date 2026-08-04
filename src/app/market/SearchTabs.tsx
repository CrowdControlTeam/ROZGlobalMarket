"use client";

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

export function SearchTabs() {
  const t = useTranslations("market");
  const { tabs, activeId, switchTab, addTab, closeTab } = useMarketSearch();

  // Nombre corto derivado de los filtros de la pestaña: término → categoría →
  // tipo; si no hay ninguno (pestaña limpia), "Búsqueda N" por su nº de creación.
  function labelOf(tab: MarketTab): string {
    const f = tab.filters ?? {};
    if (f.q) return f.q;
    if (f.category) return t(`catalog.category.${f.category}`);
    if (f.type) return t(`listing.type.${f.type}`);
    return t("searchTabs.untitled", { n: tab.seq });
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
        const count = countFilters(tab.filters ?? {});
        return (
          <div
            key={tab.id}
            className={`-mb-0.5 flex items-center gap-1 rounded-t-lg border border-b-2 px-2.5 py-1.5 text-xs ${
              active
                ? // La activa "corta" la línea: su borde inferior es del color del
                  // panel y conecta con el contenido.
                  "border-ro-accent border-b-ro-panel bg-ro-panel font-medium text-ro-text"
                : // Las inactivas continúan la línea: su borde inferior es acento
                  // (antes transparente, que la cortaba).
                  "border-ro-panel-border border-b-ro-accent bg-ro-panel-alt text-ro-text-muted hover:text-ro-text"
            }`}
          >
            <button type="button" onClick={() => switchTab(tab.id)} className="flex min-w-0 items-center gap-1">
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
