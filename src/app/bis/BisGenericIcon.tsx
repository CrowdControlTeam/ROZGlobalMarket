"use client";

import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { slotLabel, weaponTypeLabel, formatOptionAmount } from "@/lib/market-labels";
import { usePreviewTrigger, PreviewShell } from "@/components/PreviewPopover";
import { PreviewOptions, PreviewTags } from "@/app/db/items/ItemTooltip";
import type { BisEntryView } from "./BisBoard";

// Icono placeholder (Boxes) de un BiS GENÉRICO (sin item), pero con preview al
// click derecho / long-press: como no hay ficha de item, muestra lo que se
// tiene — tipo de arma o "Cualquiera" del slot, sus options y las etiquetas
// (rol/job). El contenedor lo decide el caller (card vs detalle).
export function BisGenericIcon({
  entry,
  boxClassName,
  iconSize,
}: {
  entry: BisEntryView;
  boxClassName: string;
  iconSize: number;
}) {
  const { anchor, close, triggerProps } = usePreviewTrigger();
  return (
    <>
      <div className={boxClassName} {...triggerProps}>
        <Boxes size={iconSize} aria-hidden />
      </div>
      {anchor && (
        <PreviewShell x={anchor.x} y={anchor.y} onClose={close}>
          <BisGenericPreview entry={entry} />
        </PreviewShell>
      )}
    </>
  );
}

function BisGenericPreview({ entry }: { entry: BisEntryView }) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const title = entry.weaponType ? weaponTypeLabel(tMarket, entry.weaponType) : t("anyItem");
  const options = entry.options.map(
    (o) => `${o.label}${o.minValue !== null ? ` ${formatOptionAmount(o.minValue, true)}` : ""}`,
  );
  const tags = [...entry.roles.map((r) => r.label), ...entry.jobs.map((j) => j.label)];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-ro-accent/40 text-ro-accent/70">
          <Boxes size={30} aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-base leading-tight text-ro-text-muted">{title}</h2>
          <p className="mt-1 text-xs font-medium text-ro-accent">{slotLabel(tMarket, entry.slot)}</p>
        </div>
      </div>

      {options.length > 0 && <PreviewOptions options={options} />}
      {tags.length > 0 && <PreviewTags tags={tags} />}
    </div>
  );
}
