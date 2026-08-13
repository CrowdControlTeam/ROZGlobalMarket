import Image from "next/image";
import { useTranslations } from "next-intl";
import { categoryLabel, slotLabel, weaponTypeLabel } from "@/lib/market-labels";
import { RoDescription } from "@/components/RoDescription";
import type { DbItemDetail } from "@/lib/db-items";

// Tooltip de item estilo ventana del juego: imagen grande (/icons/details) +
// nombre + meta (categoría · slot · tipo de arma) + descripción con colores.
export function ItemTooltip({ item }: { item: DbItemDetail }) {
  const tMarket = useTranslations("market");
  const name = item.slotCount > 0 ? `${item.name} [${item.slotCount}]` : item.name;
  // Para armas, categoría y slot dan la misma etiqueta ("Arma"); el Set quita
  // ese duplicado dejando p.ej. "Arma · Daga" en vez de "Arma · Arma · Daga".
  const meta = [
    ...new Set(
      [
        categoryLabel(tMarket, item.category),
        item.slot ? slotLabel(tMarket, item.slot) : null,
        item.weaponType ? weaponTypeLabel(tMarket, item.weaponType) : null,
      ].filter((p): p is string => Boolean(p)),
    ),
  ].join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-1">
          <Image
            src={`/icons/details/${item.id}.png`}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 object-contain"
          />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-base leading-tight text-ro-text">{name}</h2>
          {meta && <p className="mt-1 text-xs font-medium text-ro-accent">{meta}</p>}
        </div>
      </div>

      {item.description.length > 0 && (
        <div className="rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 p-3">
          <RoDescription lines={item.description} />
        </div>
      )}
    </div>
  );
}
