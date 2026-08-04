"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
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
}: {
  selected: ItemResult | null;
  onSelect: (item: ItemResult) => void;
  // Con un item ya elegido, el input queda bloqueado (readOnly) y el único
  // modo de cambiarlo es este botón — antes se podía editar el texto libre
  // sin que eso quitase la selección del padre, dejando secciones
  // dependientes (refine/slots/options) visibles para un item que ya no
  // coincidía con lo que decía el input.
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("market");
  const tCommon = useTranslations("common");

  function handleChange(value: string) {
    setQuery(value);
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchItems(value);
        setResults(found);
      } catch (err) {
        setError(getErrorMessage(err, tCommon("searchError")));
      }
    });
  }

  function handleClear() {
    onClear();
    setQuery("");
    setResults([]);
  }

  // Con un item elegido se muestra como TARJETA (icono + nombre + pista +
  // "Cambiar"); sin selección, el buscador con su desplegable de resultados.
  if (selected) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-ro-accent bg-ro-accent/10 p-2">
        <Image src={selected.iconUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ro-text">{selected.name}</p>
          <p className="truncate text-xs text-ro-text-muted">{itemHint(t, selected)}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-xs font-medium text-ro-accent hover:underline"
        >
          {t("itemPicker.change")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("itemPicker.placeholder")}
          className={inputClass}
        />
      </div>
      {isPending && (
        <p className="mt-1 text-sm text-ro-text-muted">{tCommon("searching")}</p>
      )}
      {!selected && error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      {!selected && results.length > 0 && (
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ro-text hover:bg-ro-gold/20"
              >
                <Image src={item.iconUrl} alt={item.name} width={24} height={24} />
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
