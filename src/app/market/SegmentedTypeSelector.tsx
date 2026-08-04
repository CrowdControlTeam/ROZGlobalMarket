"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Layers, Tag, ShoppingCart, ArrowLeftRight, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Selector de tipo de listing del mercado unificado: el tipo es un filtro más
// (query `?type=`), no una ruta. "Todo" = sin tipo; SALE/BUY/TRADE/GIFT lo
// fijan. Cada opción lleva su color de tipo; al seleccionar, el botón se rellena
// con ese color y el texto/icono pasan a blanco. En pantallas estrechas (< sm)
// se muestra solo el icono. Los valores van como literales (no el enum
// ListingType) para no arrastrar @prisma/client al bundle de cliente.
type TypeOption = {
  value: "" | "SALE" | "BUY" | "TRADE" | "GIFT";
  // Clave i18n dentro del namespace "market".
  labelKey: string;
  Icon: LucideIcon;
  // Fondo cuando está activo / color del icono cuando NO lo está.
  activeBg: string;
  iconColor: string;
};

const OPTIONS: TypeOption[] = [
  { value: "", labelKey: "typeSelector.all", Icon: Layers, activeBg: "bg-ro-type-all", iconColor: "text-ro-text-muted" },
  { value: "SALE", labelKey: "listing.type.SALE", Icon: Tag, activeBg: "bg-ro-type-sale", iconColor: "text-ro-type-sale" },
  { value: "BUY", labelKey: "listing.type.BUY", Icon: ShoppingCart, activeBg: "bg-ro-type-buy", iconColor: "text-ro-type-buy" },
  { value: "TRADE", labelKey: "listing.type.TRADE", Icon: ArrowLeftRight, activeBg: "bg-ro-type-trade", iconColor: "text-ro-type-trade" },
  { value: "GIFT", labelKey: "listing.type.GIFT", Icon: Gift, activeBg: "bg-ro-type-gift", iconColor: "text-ro-type-gift" },
];

export function SegmentedTypeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("market");
  const current = searchParams.get("type") ?? "";

  function select(value: string) {
    if (value === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("type", value);
    else params.delete("type");
    // Cambiar de tipo cierra el detalle abierto (puede no existir en el nuevo
    // filtro) y reinicia la paginación (el cursor no vive en la URL).
    params.delete("listing");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div role="group" aria-label={t("typeSelector.label")} className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((o) => {
        const active = o.value === current;
        const label = t(o.labelKey);
        return (
          <button
            key={o.value || "all"}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => select(o.value)}
            className={`inline-flex items-center gap-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? `${o.activeBg} text-ro-on-type`
                : "bg-ro-panel-alt text-ro-text-muted hover:bg-ro-panel-border/40"
            }`}
          >
            <o.Icon size={15} className={`shrink-0 ${active ? "" : o.iconColor}`} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
