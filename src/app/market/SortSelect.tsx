"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SORT_VALUES } from "@/lib/market-sort";
import { sortLabel } from "@/lib/market-labels";
import { selectClass } from "@/lib/ui";

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

  return (
    <div className="inline-flex items-center gap-2">
      <label className="hidden text-xs font-medium text-ro-text-light/80 sm:inline">{t("sort.label")}</label>
      <select
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => handleChange(e.target.value)}
        className={selectClass}
      >
        {SORT_VALUES.map((value) => (
          <option key={value} value={value}>
            {sortLabel(t, value)}
          </option>
        ))}
      </select>
    </div>
  );
}
