"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ItemIcon } from "@/components/ItemIcon";
import { searchCards } from "@/lib/listings";
import { inputClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";
import type { EquipSlot } from "@/db/enums";

export type CardResult = Awaited<ReturnType<typeof searchCards>>[number];

// Buscador de cartas (categoría CARD) para una ranura de una pieza. Mismo patrón
// debounce + desplegable que ItemPicker, pero simple (sin pista de categoría).
// Si se pasa `equipSlot`, solo ofrece cartas que encajan en ese slot de equipo.
export function CardPicker({
  onSelect,
  placeholder,
  equipSlot,
}: {
  onSelect: (card: CardResult) => void;
  placeholder: string;
  equipSlot?: EquipSlot;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tCommon = useTranslations("common");
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
          setResults(await searchCards(value, equipSlot));
        } catch (err) {
          setError(getErrorMessage(err, tCommon("searchError")));
        }
      });
    }, 250);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} h-9 text-sm ${isPending ? "pr-9" : ""}`}
      />
      {isPending && (
        <span
          role="status"
          aria-label={tCommon("searching")}
          className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ro-text-muted/30 border-t-ro-accent"
        />
      )}
      {error && <p className="absolute inset-x-0 top-full z-20 mt-1 text-xs text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1 shadow-xl">
          {results.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(card);
                  setResults([]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-ro-text hover:bg-ro-accent/15"
              >
                <ItemIcon item={card} width={22} height={22} alt="" />
                <span className="flex-1 truncate">{card.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
