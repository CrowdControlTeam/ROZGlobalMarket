"use client";

import { useTranslations } from "next-intl";
import { Layers, Tag, ShoppingCart, ArrowLeftRight, Gift } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMarketSearch } from "./marketSearchStore";

// Selector de tipo del mercado unificado: pill a todo el ancho con un segmento
// por tipo (Todo · Venta · Compra · Intercambio · Regalo), todos del mismo
// tamaño (flex-1). El tipo es un filtro (`?type=`), no una ruta. Inactivo =
// label en color de texto + icono con el color del tipo; activo = el segmento
// se rellena con el color del tipo y todo pasa a blanco. En móvil (< sm) solo
// icono. Los valores van como literales para no arrastrar @prisma/client al
// bundle de cliente.
type TypeOption = {
  value: "" | "SALE" | "BUY" | "TRADE" | "GIFT";
  labelKey: string;
  Icon: LucideIcon;
  activeBg: string;
  // Color del icono cuando NO está activo ("" = hereda el color del texto).
  iconColor: string;
};

const OPTIONS: TypeOption[] = [
  { value: "", labelKey: "typeSelector.all", Icon: Layers, activeBg: "bg-ro-type-all", iconColor: "" },
  { value: "SALE", labelKey: "listing.type.SALE", Icon: Tag, activeBg: "bg-ro-type-sale", iconColor: "text-ro-type-sale" },
  { value: "BUY", labelKey: "listing.type.BUY", Icon: ShoppingCart, activeBg: "bg-ro-type-buy", iconColor: "text-ro-type-buy" },
  { value: "TRADE", labelKey: "listing.type.TRADE", Icon: ArrowLeftRight, activeBg: "bg-ro-type-trade", iconColor: "text-ro-type-trade" },
  { value: "GIFT", labelKey: "listing.type.GIFT", Icon: Gift, activeBg: "bg-ro-type-gift", iconColor: "text-ro-type-gift" },
];

export function SegmentedTypeSelector() {
  const t = useTranslations("market");
  const { filters, setFilter } = useMarketSearch();
  const current = filters.type ?? "";

  function select(value: string) {
    if (value === current) return;
    // El tipo es un filtro más de la pestaña activa; el store lo serializa a la
    // URL (que cierra el detalle y reinicia la paginación).
    setFilter("type", value);
  }

  return (
    <div
      role="group"
      aria-label={t("typeSelector.label")}
      className="flex gap-1.5 rounded-full border border-ro-panel-border bg-ro-panel-alt p-1"
    >
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
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1.5 text-xs font-medium transition-colors ${
              active ? `${o.activeBg} text-ro-on-type` : "text-ro-text hover:bg-ro-panel-border/40"
            }`}
          >
            <o.Icon size={14} className={`shrink-0 ${active ? "" : o.iconColor}`} aria-hidden />
            <span className="hidden truncate sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
