"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
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

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={selected ? selected.name : query}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={!!selected}
          placeholder={t("itemPicker.placeholder")}
          className={`${inputClass} ${selected ? "cursor-default pr-8" : ""}`}
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("itemPicker.removeSelected")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ro-text-muted hover:text-ro-gold"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {!selected && isPending && (
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
