"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount } from "@/lib/market-labels";
import type { BisEntryView } from "./BisBoard";

export type BisDetailData = { entry: BisEntryView; slotLabel: string };

// Ficha de un BiS: panel lateral en desktop, bottom sheet en móvil. A
// diferencia del detalle del mercado (atado a la URL con router.back), este va
// controlado por estado del board (la entrada ya está en memoria), así que se
// cierra llamando a onClose. Se cierra con la X, Escape o (en móvil)
// arrastrando el panel hacia abajo. Mismo look que market/DetailPanel.
export function BisDetail({ data, onClose }: { data: BisDetailData; onClose: () => void }) {
  const t = useTranslations("bis");
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

  const { entry, slotLabel } = data;
  const title = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
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

      <div className="flex shrink-0 justify-start px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("detail.close")}
          className="grid h-7 w-7 place-items-center rounded-md leading-none text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
        {/* Cabecera: icono grande + nombre + slot. */}
        <header className="flex items-center gap-3">
          {entry.item ? (
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel-alt">
              <Image src={entry.item.iconUrl} alt={entry.item.name} width={40} height={40} />
            </div>
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-ro-panel-border bg-ro-panel-alt text-ro-text-muted">
              <Boxes size={22} aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className={`text-base font-bold ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}>{title}</p>
            <p className="text-xs uppercase tracking-wide text-ro-text-muted">{slotLabel}</p>
          </div>
        </header>

        {entry.options.length > 0 && <DetailSection title={t("detail.options")}>
          <ul className="flex flex-col gap-1.5">
            {entry.options.map((o) => (
              <li
                key={o.slotIndex}
                className="flex items-center justify-between gap-2 rounded-md border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5 text-sm"
              >
                <span className="text-ro-text">{o.label}</span>
                <span className="shrink-0 font-semibold text-ro-accent">
                  {o.minValue !== null ? formatOptionAmount(o.minValue, true) : t("detail.optionAny")}
                </span>
              </li>
            ))}
          </ul>
        </DetailSection>}

        {entry.roles.length > 0 && (
          <DetailSection title={t("detail.roles")}>
            <div className="flex flex-wrap gap-1.5">
              {entry.roles.map((r) => (
                <span key={r.id} className="rounded border border-ro-accent/40 bg-ro-accent/10 px-2 py-0.5 text-xs text-ro-accent">
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
                <span key={j.id} className="rounded border border-ro-panel-border bg-ro-panel-alt px-2 py-0.5 text-xs text-ro-text-muted">
                  {j.label}
                </span>
              ))}
            </div>
          </DetailSection>
        )}

        {entry.note && (
          <DetailSection title={t("detail.note")}>
            <p className="whitespace-pre-wrap text-sm text-ro-text">{entry.note}</p>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ro-text-muted">{title}</h3>
      {children}
    </section>
  );
}
