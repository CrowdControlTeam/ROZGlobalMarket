"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ItemIcon } from "@/components/ItemIcon";
import { useTranslations } from "next-intl";
import { Boxes, Pencil, Search, type LucideIcon } from "lucide-react";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount, weaponTypeLabel } from "@/lib/market-labels";
import { bisEntryMarketQuery } from "./bis-market-link";
import type { BisEntryView } from "./BisBoard";

export type BisDetailData = { entry: BisEntryView; slotLabel: string; slotIcon: LucideIcon };

// Ficha de un BiS: panel lateral en desktop, bottom sheet en móvil. A
// diferencia del detalle del mercado (atado a la URL con router.back), este va
// controlado por estado del board (la entrada ya está en memoria), así que se
// cierra llamando a onClose. Se cierra con la X, Escape o (en móvil)
// arrastrando el panel hacia abajo. Mismo look que market/DetailPanel.
export function BisDetail({
  data,
  canEdit,
  onEdit,
  onClose,
}: {
  data: BisDetailData;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  // Entra deslizándose (desde abajo en móvil, desde la derecha en desktop): se
  // difiere a rAF para que se pinte primero la posición inicial fuera de
  // pantalla y la transición se vea.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    setIsDragging(true);
    startYRef.current = e.clientY;
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  }
  function handlePointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    if (dragY > 100) onClose();
    else setDragY(0);
  }

  const { entry, slotLabel, slotIcon: SlotIcon } = data;
  const name = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
    : entry.weaponType
      ? weaponTypeLabel(tMarket, entry.weaponType)
      : t("anyItem");

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-40 flex h-auto max-h-[70vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-ro-panel-border bg-ro-panel text-ro-text shadow-2xl transition-transform duration-200 md:left-auto md:top-0 md:h-full md:max-h-none md:w-[420px] md:max-w-[85vw] md:rounded-none md:rounded-l-2xl md:border-l md:border-t-0 ${
        mounted ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full"
      }`}
      style={isDragging ? { transform: `translateY(${dragY}px)`, transitionDuration: "0ms" } : undefined}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2 active:cursor-grabbing md:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-ro-panel-border" />
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("detail.close")}
          className="grid h-7 w-7 place-items-center rounded-md leading-none text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text"
        >
          ✕
        </button>
        <div className="flex items-center gap-2">
          <Link
            href={`/market?${bisEntryMarketQuery(data.entry)}`}
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-md border border-ro-panel-border px-2.5 py-1 text-xs font-medium text-ro-text transition-colors hover:border-ro-accent hover:text-ro-accent"
          >
            <Search size={13} aria-hidden />
            {t("searchInMarket")}
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-md border border-ro-panel-border px-2.5 py-1 text-xs font-medium text-ro-text transition-colors hover:border-ro-accent hover:text-ro-accent"
            >
              <Pencil size={13} aria-hidden />
              {t("edit")}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
        {/* Hero: banda con degradado de acento + icono del slot como marca de
            agua y como chip; icono del item grande con badge de refine. */}
        <header className="relative -mx-4 -mt-2 overflow-hidden border-y border-ro-panel-border bg-gradient-to-br from-ro-accent/12 via-ro-panel-alt to-ro-panel px-4 py-4">
          <SlotIcon
            size={104}
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-5 text-ro-accent/10"
          />
          <div className="relative flex items-center gap-3.5">
            <div className="relative shrink-0">
              {entry.item ? (
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-ro-panel-border bg-ro-panel shadow-sm">
                  <ItemIcon
                    item={entry.item}
                    width={52}
                    height={52}
                    refine={entry.item.refineLevel}
                    options={entry.options.map(
                      (o) => `${o.label}${o.minValue !== null ? ` ${formatOptionAmount(o.minValue, true)}` : ""}`,
                    )}
                  />
                </div>
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-ro-accent/40 bg-ro-panel text-ro-accent/70">
                  <Boxes size={30} aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-ro-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ro-accent">
                <SlotIcon size={12} aria-hidden />
                {slotLabel}
              </span>
              <p className={`truncate text-lg font-bold leading-tight ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}>
                {name}
              </p>
            </div>
          </div>
        </header>

        {entry.options.length > 0 && (
          <DetailSection title={t("detail.options")}>
            <ul className="flex flex-col gap-1.5">
              {entry.options.map((o) => (
                <li
                  key={o.slotIndex}
                  className="flex items-center gap-2.5 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-2"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ro-accent/15 text-[0.7rem] font-bold text-ro-accent">
                    {o.slotIndex}
                  </span>
                  <span className="flex-1 text-sm text-ro-text">{o.label}</span>
                  {o.minValue !== null && (
                    <span className="shrink-0 rounded-full bg-ro-accent/10 px-2 py-0.5 text-xs font-bold text-ro-accent">
                      {formatOptionAmount(o.minValue, true)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {entry.roles.length > 0 && (
          <DetailSection title={t("detail.roles")}>
            <div className="flex flex-wrap gap-1.5">
              {entry.roles.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ro-accent/40 bg-ro-accent/10 px-2.5 py-1 text-xs font-medium text-ro-accent"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ro-accent" aria-hidden />
                  {r.label}
                </span>
              ))}
            </div>
          </DetailSection>
        )}

        {entry.jobs.length > 0 && (
          <DetailSection title={t("detail.jobs")}>
            <div className="flex flex-wrap gap-1.5">
              {entry.jobs.map((j) => (
                <span
                  key={j.id}
                  className="rounded-full border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1 text-xs font-medium text-ro-text"
                >
                  {j.label}
                </span>
              ))}
            </div>
          </DetailSection>
        )}

        {entry.note && (
          <DetailSection title={t("detail.note")}>
            <p className="whitespace-pre-wrap rounded-lg border border-ro-panel-border bg-ro-panel-alt px-3 py-2 text-sm text-ro-text">
              {entry.note}
            </p>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
        <span className="h-3 w-1 rounded-full bg-ro-accent" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}
