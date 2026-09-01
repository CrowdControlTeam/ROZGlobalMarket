"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Search } from "lucide-react";
import type { BuildSlot } from "@/db/enums";
import { getJob } from "@/lib/skill-planner";
import { parsePositions, POSITION_TO_SLOT, PAPERDOLL_LEFT, PAPERDOLL_RIGHT } from "@/lib/build-constants";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { ItemIcon } from "@/components/ItemIcon";
import { buttonClass } from "@/lib/ui";
import type { getBuild } from "@/lib/builds";

// Detalle de una build (paperdoll estilo juego), reutilizado por la página de
// detalle (/builds/[id]) y por el panel derecho del navegador de builds. La
// disponibilidad en mercado llega como objeto plano (serializable) en vez de Map.
export type BuildDetail = NonNullable<Awaited<ReturnType<typeof getBuild>>>;
type Entry = BuildDetail["entries"][number];

export function BuildDetailView({
  build,
  meId,
  availability,
}: {
  build: BuildDetail;
  meId: string;
  availability: Record<string, number>;
}) {
  const t = useTranslations("builds");
  const tSlot = useTranslations("builds.slots");
  const tTag = useTranslations("builds.tags");

  const isOwner = build.owner.id === meId;
  const jobName = getJob(build.jobId)?.name ?? "—";
  const bySlot = new Map(build.entries.map((e) => [e.slot, e]));

  // Ocupación de tocados: un tocado multi-slot (p. ej. "Middle, Lower") se
  // muestra en TODAS sus celdas. `primary` marca la celda donde se guarda (ahí
  // van las options/cartas; en las demás solo el item).
  const headAt = new Map<BuildSlot, { e: Entry; primary: boolean }>();
  for (const e of build.entries) {
    for (const p of parsePositions(e.item.position)) {
      const s = POSITION_TO_SLOT[p];
      headAt.set(s, { e, primary: s === e.slot });
    }
  }

  // Enlace al mercado por pieza: nombre + refino (≥) + nº de ranuras + options
  // (stat ≥ valor). El mercado no filtra por cartas concretas, así que se incluye
  // el nº de ranuras (variante), no la carta en sí.
  const marketHref = (e: Entry) => {
    const p = new URLSearchParams();
    p.set("newTab", "1");
    p.set("q", e.item.name);
    if (e.refineLevel > 0) p.set("refineMin", String(e.refineLevel));
    if (e.item.slotCount > 0) {
      p.set("cardSlotsMin", String(e.item.slotCount));
      p.set("cardSlotsMax", String(e.item.slotCount));
    }
    for (const o of e.options) {
      p.set(`option${o.slotIndex}Stat`, o.def.statCode);
      p.set(`option${o.slotIndex}Min`, String(o.value));
    }
    return `/market?${p.toString()}`;
  };

  // Publicar la pieza en el mercado con todo lo que se sabe de la build. Tipo:
  // COMPRAR si la build es propia (busco esa pieza), VENDER si es de otro (podría
  // vendérsela/regalársela). Si no es propia, se precarga el dueño como
  // destinatario de regalo (?recipient). Refino y options van como semilla.
  const publishHref = (e: Entry) => {
    const p = new URLSearchParams();
    p.set("publish", isOwner ? "BUY" : "SALE");
    p.set("item", e.item.id);
    if (e.refineLevel > 0) p.set("refine", String(e.refineLevel));
    for (const o of e.options) {
      p.set(`option${o.slotIndex}DefId`, o.defId);
      p.set(`option${o.slotIndex}Value`, String(o.value));
    }
    if (!isOwner) p.set("recipient", build.owner.id);
    return `/market?${p.toString()}`;
  };

  // Celda de un slot del paperdoll: cabecera (nombre del slot + acciones de
  // mercado a la derecha) e, debajo, icono + nombre (con refino) + chips de
  // options/cartas. Vacía = marco punteado. Las acciones (badge de disponibilidad,
  // lupa de búsqueda y "+" de publicar) van arriba a la derecha, para todos.
  const cell = (slot: BuildSlot) => {
    const head = headAt.get(slot);
    const e = head ? head.e : bySlot.get(slot);
    // En una celda secundaria de un tocado multi-slot, las options/cartas y las
    // acciones se muestran solo en su celda principal.
    const showExtras = head ? head.primary : true;
    const onSale = e ? (availability[e.item.id] ?? 0) : 0;
    return (
      <div
        className={`flex h-full min-h-[3.5rem] flex-col gap-1.5 rounded-lg border border-ro-panel-border p-2 ${
          e ? "bg-ro-panel-alt" : "bg-ro-panel-alt/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ro-text-muted">{tSlot(slot)}</span>
          {e && showExtras && (
            <div className="flex shrink-0 items-center gap-1">
              {onSale > 0 && (
                <span className="rounded bg-green-600/15 px-1 py-0.5 text-[0.65rem] font-semibold text-green-600">
                  {t("detail.onSale", { n: onSale })}
                </span>
              )}
              <Link
                href={marketHref(e)}
                aria-label={t("detail.searchMarket")}
                title={t("detail.searchMarket")}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ro-panel-border text-ro-accent transition-colors hover:bg-ro-accent/10"
              >
                <Search size={13} aria-hidden />
              </Link>
              <Link
                href={publishHref(e)}
                aria-label={t("detail.publishItem")}
                title={t("detail.publishItem")}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ro-panel-border text-ro-accent transition-colors hover:bg-ro-accent/10"
              >
                <Plus size={14} aria-hidden />
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border ${
              e ? "border-ro-panel-border bg-ro-panel" : "border-dashed border-ro-panel-border/60"
            }`}
          >
            {e && <ItemIcon item={e.item} width={28} height={28} refine={e.refineLevel} alt="" />}
          </div>
          <div className="min-w-0 flex-1">
            {e ? (
              <>
                <p className="truncate text-sm text-ro-text">
                  {formatItemDisplayName(e.item.name, e.refineLevel, e.item.slotCount)}
                </p>
                {showExtras && (e.options.length > 0 || e.cards.length > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {e.options.map((o) => (
                      <span key={o.id} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1 py-0.5 text-[0.65rem] text-ro-accent">
                        {o.def.label} {o.value}
                      </span>
                    ))}
                    {e.cards.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-0.5 rounded border border-ro-panel-border bg-ro-panel px-1 py-0.5 text-[0.65rem] text-ro-text-muted">
                        <ItemIcon item={c.card} width={14} height={14} alt="" />
                        {c.card.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ro-text-muted/50">—</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 title={build.name} className="min-w-0 flex-1 truncate text-2xl font-extrabold text-ro-text">{build.name}</h1>
            {build.tags.length > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                {build.tags.map((tag) => (
                  <span key={tag} className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-xs text-ro-accent">
                    {tTag(tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ro-text-muted">
            <span className="font-semibold text-ro-text">{jobName}</span>
            <span className="min-w-0 break-all">· {isOwner ? t("list.you") : build.owner.username}</span>
          </p>
        </div>
        {isOwner && (
          <Link href={`/builds/${build.id}/edit`} className={`shrink-0 ${buttonClass("outline")}`}>
            <Pencil size={15} aria-hidden />
            {t("list.edit")}
          </Link>
        )}
      </div>

      {build.notes && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ro-text">{build.notes}</p>
      )}

      {/* Paperdoll: dos columnas (izquierda / derecha). Las celdas van en una
          única rejilla con filas de igual alto (auto-rows-fr), así todos los
          slots ocupan lo mismo. Se intercalan izquierda/derecha por fila. */}
      <div className="mt-5 grid grid-cols-1 gap-2 sm:auto-rows-fr sm:grid-cols-2">
        {PAPERDOLL_LEFT.map((left, i) => {
          const right = PAPERDOLL_RIGHT[i];
          return (
            <Fragment key={left}>
              <div className="h-full">{cell(left)}</div>
              <div className="h-full">{cell(right)}</div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
