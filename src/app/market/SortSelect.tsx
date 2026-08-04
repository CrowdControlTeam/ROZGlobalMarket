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

  // El <select> ES la píldora (ocupa todo el ancho, clicable en cualquier
  // punto). El icono y el caret van encima con pointer-events-none, así el
  // click los atraviesa y abre el desplegable. Fondo sólido para que el popup
  // nativo pinte las opciones legibles; padding (pl/pr) para que el texto no
  // toque los bordes.
  return (
    <div className="relative inline-flex items-center">
      <ArrowUpDown
        size={13}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ro-text-muted"
        aria-hidden
      />
      <select
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t("sort.label")}
        className="min-w-[190px] cursor-pointer appearance-none rounded-lg border border-ro-panel-border bg-ro-panel-alt py-1.5 pl-9 pr-9 text-xs text-ro-text focus:outline-none"
      >
        {SORT_VALUES.map((value) => (
          <option key={value} value={value} className="bg-ro-panel text-ro-text">
            {sortLabel(t, value)}
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
