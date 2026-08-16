import Image from "next/image";
import { useTranslations } from "next-intl";
import { categoryLabel, slotLabel, weaponTypeLabel } from "@/lib/market-labels";
import { RoDescription } from "@/components/RoDescription";
import { TagBadge, type TagVariant } from "@/components/TagBadge";
import type { DbItemDetail } from "@/lib/db-items";

export type PreviewTag = { label: string; variant: TagVariant };

// Tooltip de item estilo ventana del juego: imagen grande (/icons/details) +
// nombre + meta + descripción con colores, y —como en el juego— un bloque por
// cada random option y un último bloque con los slots de carta. `options` son
// cadenas ya formateadas (p. ej. "ATK +28"); las pasa quien tenga esa info (una
// card de listing), no el item genérico.
export function ItemTooltip({
  item,
  options,
  refine,
  tags,
}: {
  item: DbItemDetail;
  options?: string[];
  // Refine de la instancia (un listing). El juego no lo pone en la ficha, pero
  // aquí sí se muestra como prefijo del nombre ("+7 …"). Opcional.
  refine?: number;
  // Etiquetas extra (rol/job de un BiS); no vienen del juego. Opcional.
  tags?: PreviewTag[];
}) {
  const tMarket = useTranslations("market");
  const name = `${refine ? `+${refine} ` : ""}${item.name}${item.slotCount > 0 ? ` [${item.slotCount}]` : ""}`;
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
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Image
          src={`/icons/details/${item.id}.png`}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <h2 className="font-heading text-base leading-tight text-ro-text">{name}</h2>
          {meta && <p className="mt-1 text-xs font-medium text-ro-accent">{meta}</p>}
          {/* Etiquetas del BiS (rol/job) bajo el tipo. No vienen del juego. */}
          {tags && tags.length > 0 && <PreviewTags tags={tags} className="mt-1.5" />}
        </div>
      </div>

      {item.description.length > 0 && (
        <div className="rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 p-3">
          <RoDescription lines={item.description} />
        </div>
      )}

      {/* Un bloque por option (como las ventanitas extra del juego). */}
      {options && options.length > 0 && <PreviewOptions options={options} />}

      {/* Bloque final con los slots de carta (rombos vacíos). */}
      {item.slotCount > 0 && (
        <div className="flex items-center justify-center gap-2.5 rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 px-3 py-2">
          {Array.from({ length: item.slotCount }).map((_, i) => (
            <span
              key={i}
              className="h-3.5 w-3.5 rotate-45 rounded-[2px] border border-ro-text-muted/60"
              aria-hidden
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Un bloque por random option (como las ventanitas extra del juego), estilo
// neutro. Compartido con la ficha genérica de BiS. Las cadenas vienen ya
// formateadas (p. ej. "ATK +28").
export function PreviewOptions({ options }: { options: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o, i) => (
        <div
          key={i}
          className="rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 px-3 py-1.5 text-center text-sm text-ro-text"
        >
          {o}
        </div>
      ))}
    </div>
  );
}

// Chips de etiquetas para la preview (compartido con la ficha genérica de BiS).
// Reutiliza TagBadge para mantener el estilo rol/job de las cards.
export function PreviewTags({ tags, className }: { tags: PreviewTag[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {tags.map((t, i) => (
        <TagBadge key={i} label={t.label} variant={t.variant} />
      ))}
    </div>
  );
}
