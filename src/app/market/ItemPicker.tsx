"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { useTranslations } from "next-intl";
import type { EquipSlot } from "@/db/enums";
import { searchItems } from "@/lib/listings";
import { inputClass } from "@/lib/ui";
import { categoryLabel, weaponTypeLabel } from "@/lib/market-labels";
import { getErrorMessage } from "@/lib/errors";

export type ItemResult = Awaited<ReturnType<typeof searchItems>>[number];

// El catálogo tiene bastantes nombres duplicados (p.ej. dos "Arc Wand": un
// arma real y un costume cosmético) — sin esta pista, elegir el resultado
// equivocado en la lista es indistinguible hasta publicar, y ese es
// justo el item cuya categoría/tipo decide si aparecen refine/slots/options.
function itemHint(t: (key: string) => string, item: ItemResult): string {
  if (item.category === "WEAPON" && item.weaponType) {
    return `${categoryLabel(t, item.category)} · ${weaponTypeLabel(t, item.weaponType)}`;
  }
  return categoryLabel(t, item.category);
}

export function ItemPicker({
  selected,
  onSelect,
  onClear,
  locked = false,
  slotFilter,
  positionFilter,
  filterResult,
}: {
  selected: ItemResult | null;
  onSelect: (item: ItemResult) => void;
  // En edición el item no se cambia: se muestra la tarjeta sin "Cambiar".
  locked?: boolean;
  // Con un item ya elegido, el input queda bloqueado (readOnly) y el único
  // modo de cambiarlo es este botón — antes se podía editar el texto libre
  // sin que eso quitase la selección del padre, dejando secciones
  // dependientes (refine/slots/options) visibles para un item que ya no
  // coincidía con lo que decía el input.
  onClear: () => void;
  // Si se pasa, la búsqueda solo devuelve items que encajan en ese slot de
  // equipo (lo usa el editor de builds para no ofrecer items de otro slot).
  slotFilter?: EquipSlot;
  // Además del slot, acota los tocados a una posición (Upper/Middle/Lower) —
  // lo usan los 3 slots de tocado del editor de builds.
  positionFilter?: "Upper" | "Middle" | "Lower";
  // Filtro extra en cliente sobre los resultados (el editor de builds lo usa
  // para la ocupación multi-slot de tocados: solo los que puede colocar aquí).
  filterResult?: (item: ItemResult) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market");
  const tCommon = useTranslations("common");

  // Debounce: no lanzar una búsqueda (server action) por cada tecla; se espera a
  // una pausa breve. Además evita que el indicador de carga parpadee sin parar.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const found = await searchItems(value, slotFilter, positionFilter);
          setResults(found);
        } catch (err) {
          setError(getErrorMessage(err, tCommon("searchError")));
        }
      });
    }, 250);
  }

  function handleClear() {
    onClear();
    setQuery("");
    setResults([]);
  }

  const shownResults = filterResult ? results.filter(filterResult) : results;

  // Con un item elegido se muestra como TARJETA (icono + nombre + pista +
  // "Cambiar"); sin selección, el buscador con su desplegable de resultados.
  if (selected) {
    return (
      <div className="flex h-12 items-center gap-2.5 rounded-lg border border-ro-accent bg-ro-accent/10 px-2">
        <ItemIcon item={selected} width={32} height={32} className="h-8 w-8 shrink-0" alt="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ro-text">{selected.name}</p>
          <p className="truncate text-xs text-ro-text-muted">{itemHint(t, selected)}</p>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-xs font-medium text-ro-accent hover:underline"
          >
            {t("itemPicker.change")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t("itemPicker.placeholder")}
        className={`${inputClass} h-12 ${isPending ? "pr-10" : ""}`}
      />
      {/* Spinner e indicador de estado SUPERPUESTOS (posición absoluta): no
          entran en el flujo, así que no empujan el contenido de abajo ni
          provocan el temblor al aparecer/desaparecer en cada tecleo. */}
      {isPending && (
        <span
          role="status"
          aria-label={tCommon("searching")}
          className="absolute right-3 top-6 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ro-text-muted/30 border-t-ro-accent"
        />
      )}
      {error && (
        <p className="absolute inset-x-0 top-full z-20 mt-1 text-sm text-red-700">{error}</p>
      )}
      {shownResults.length > 0 && (
        // Desplegable FLOTANTE (absoluto) para no empujar el contenido del modal
        // ni generar scroll: se superpone sobre lo de debajo.
        <ul className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1 shadow-xl">
          {shownResults.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ro-text hover:bg-ro-accent/15"
              >
                <ItemIcon item={item} width={24} height={24} />
                <span className="flex-1">
                  {item.name}
                  <span className="block text-xs text-ro-text-muted">{itemHint(t, item)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
