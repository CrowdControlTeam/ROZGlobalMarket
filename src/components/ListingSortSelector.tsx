"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";

// Orden de "Mis publicaciones" por fecha de publicación (createdAt): más
// recientes primero (desc, por defecto) o más antiguas primero (asc). Grupo de
// dos botones con flecha (mismo patrón visual que el selector de idioma). El
// orden real lo aplica el server component leyendo `?sort=asc`.
export function ListingSortSelector() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("myActivity.sort");
  const current = params.get("sort") === "asc" ? "asc" : "desc";

  function select(next: "asc" | "desc") {
    if (next === current) return;
    const p = new URLSearchParams(params.toString());
    if (next === "desc") p.delete("sort");
    else p.set("sort", "asc");
    const qs = p.toString();
    router.replace(qs ? `/market/activity/listings?${qs}` : "/market/activity/listings", { scroll: false });
  }

  const options = [
    { value: "desc", Icon: ArrowDown, label: t("newest") },
    { value: "asc", Icon: ArrowUp, label: t("oldest") },
  ] as const;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-ro-panel-border"
    >
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={o.label}
            aria-label={o.label}
            onClick={() => select(o.value)}
            className={`grid h-8 w-9 place-items-center transition-colors ${
              active ? "bg-ro-type-all text-ro-on-type" : "text-ro-text-muted hover:bg-ro-text/5"
            }`}
          >
            <o.Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
