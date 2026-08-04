"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { SORT_VALUES, SORT_DIRECTION } from "@/lib/market-sort";
import { sortLabel } from "@/lib/market-labels";
import { useMarketSearch } from "./marketSearchStore";

// Marca de dirección: flecha estilizada de punta triangular ⭣ (descendente) /
// ⭡ (ascendente), separada del texto con un em-space ( ) para que no
// parezca parte del nombre.
const DIR_MARK = { desc: "⭣", asc: "⭡" } as const;

export function SortSelect() {
  const t = useTranslations("market");
  const { filters, setFilter } = useMarketSearch();

  function handleChange(value: string) {
    // "newest" es el valor por defecto: se guarda vacío para no ensuciar la URL.
    setFilter("sort", value === "newest" ? "" : value);
  }

  // El <select> ES la píldora (ocupa todo el ancho, clicable en cualquier
  // punto). Cada opción lleva delante la flecha de dirección; se ve en el
  // desplegable y en el valor cerrado (aprovecha el espacio izquierdo). El
  // caret va encima con pointer-events-none para no bloquear el click. Fondo
  // sólido para que el popup nativo pinte las opciones legibles.
  return (
    <div className="relative inline-flex items-center">
      <select
        value={filters.sort ?? "newest"}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t("sort.label")}
        className="min-w-[190px] cursor-pointer appearance-none rounded-lg border border-ro-panel-border bg-ro-panel-alt py-1.5 pl-3 pr-9 text-xs text-ro-text focus:outline-none"
      >
        {SORT_VALUES.map((value) => (
          <option key={value} value={value} className="bg-ro-panel text-ro-text">
            {`${DIR_MARK[SORT_DIRECTION[value]]} ${sortLabel(t, value)}`}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ro-text-muted"
        aria-hidden
      />
    </div>
  );
}
