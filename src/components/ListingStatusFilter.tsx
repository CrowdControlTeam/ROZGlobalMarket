"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LISTING_STATUS_VALUES } from "@/db/enums";

// Badges para filtrar "Mis publicaciones" por estado (Activa / Completada /
// Expirada / Cancelada). Todos cuentan como marcados por defecto (sin parámetro
// en la URL = se muestran todos); al desmarcar uno se añade `?<estado>=0` (clave
// en minúscula). El filtrado real lo hace el server component leyendo esos
// parámetros — aquí solo se alterna la URL.
function isOn(params: URLSearchParams, key: string): boolean {
  return params.get(key) !== "0";
}

export function ListingStatusFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("myActivity.statusFilter");

  function toggle(status: string) {
    const key = status.toLowerCase();
    const next = new URLSearchParams(params.toString());
    if (isOn(next, key)) next.set(key, "0");
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `/market/activity/listings?${qs}` : "/market/activity/listings", { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {LISTING_STATUS_VALUES.map((status) => {
        const on = isOn(params, status.toLowerCase());
        return (
          <button
            key={status}
            type="button"
            onClick={() => toggle(status)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              on
                ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
                : "border-ro-panel-border text-ro-text-muted hover:text-ro-text"
            }`}
          >
            {t(status)}
          </button>
        );
      })}
    </div>
  );
}
