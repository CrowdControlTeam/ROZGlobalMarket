"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { SORT_VALUES } from "@/lib/market-sort";
import { sortLabel } from "@/lib/market-labels";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    // Solo cambia el orden; los filtros ya presentes en la URL se mantienen.
    router.push(`${pathname}?${params.toString()}`);
  }

  // Píldora estilo diseño: icono de orden + valor actual + caret. El <select>
  // nativo va transparente encima (appearance-none) para conservar el
  // desplegable del sistema sin su chrome por defecto.
  return (
    <div className="relative inline-flex items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt py-1.5 pl-3 pr-7 text-xs text-ro-text">
      <ArrowUpDown size={13} className="shrink-0 text-ro-text-muted" aria-hidden />
      {/* Fondo sólido (no transparent) para que el desplegable nativo pinte las
          opciones legibles: al ser transparent, el popup salía con texto del
          tema sobre fondo blanco del SO (invisibles). Igual bg que la píldora,
          así se funde. Las opciones llevan color explícito por si el SO ignora
          el del <select>. */}
      <select
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t("sort.label")}
        className="cursor-pointer appearance-none bg-ro-panel-alt text-ro-text focus:outline-none"
      >
        {SORT_VALUES.map((value) => (
          <option key={value} value={value} className="bg-ro-panel text-ro-text">
            {sortLabel(t, value)}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2 shrink-0 text-ro-text-muted"
        aria-hidden
      />
    </div>
  );
}
