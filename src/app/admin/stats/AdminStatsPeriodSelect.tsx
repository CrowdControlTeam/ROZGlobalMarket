"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { STATS_PERIOD_VALUES } from "@/lib/admin-stats-constants";
import { selectClass } from "@/lib/ui";

export function AdminStatsPeriodSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("admin.stats.period");

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/admin/stats?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-ro-text-muted">{t("label")}</label>
      <select
        value={searchParams.get("period") ?? "30d"}
        onChange={(e) => handleChange(e.target.value)}
        className={selectClass}
      >
        {STATS_PERIOD_VALUES.map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
    </div>
  );
}
