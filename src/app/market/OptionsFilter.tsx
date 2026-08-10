"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Plus } from "lucide-react";
import { inputBaseClass, selectClass } from "@/lib/ui";

type StatOption = { statCode: string; label: string; minValue: number; maxValue: number };
type OptionFilterSelection = { statCode: string; min: number | ""; max: number | "" };

// Filtro de random options (posicional: hasta MAX_OPTION_SLOTS slots, cada uno
// con su propio pool de stats). Reemplaza los selectores + inputs fijos por
// CHIPS: cada slot es un chip (si está puesto) o un disparador "+ Op N"; al
// pulsarlo se abre un POPOVER debajo con el selector de stat + min/max de ESE
// slot (el slot va implícito por el disparador, sin elegir posición). El
// popover se ancla a la fila de chips y ocupa su ancho, así no se sale del
// panel estrecho. Aplica al vuelo (el chip aparece en cuanto se elige el stat).
export function OptionsFilter({
  statsBySlot,
  selections,
  isBuy,
  onStatChange,
  onMinChange,
  onMaxChange,
  onClear,
}: {
  statsBySlot: StatOption[][];
  selections: OptionFilterSelection[];
  isBuy: boolean;
  onStatChange: (index: number, statCode: string) => void;
  onMinChange: (index: number, value: string) => void;
  onMaxChange: (index: number, value: string) => void;
  onClear: (index: number) => void;
}) {
  const t = useTranslations("market.filters");
  // Índice del slot cuyo popover está abierto (null = ninguno).
  const [editing, setEditing] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing === null) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      // Dentro del popover → se mantiene abierto.
      if (popoverRef.current?.contains(target)) return;
      // Sobre un chip/disparador (un botón del contenedor): lo gestiona su
      // propio onClick (abrir/cambiar/cerrar), no cerramos aquí.
      const el = target instanceof Element ? target : null;
      if (rootRef.current?.contains(target) && el?.closest("button")) return;
      // Cualquier otro sitio —incluido el HUECO del contenedor de options, otra
      // sección o los resultados— cierra. Antes la referencia era el contenedor
      // entero, así que clicar en su hueco no cerraba (el bug reportado).
      setEditing(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditing(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing]);

  function chipText(index: number): string {
    const sel = selections[index];
    const stat = statsBySlot[index].find((s) => s.statCode === sel.statCode);
    // En BUY el valor es un mínimo ("20+"); en el resto, un rango del roll real.
    const range = isBuy
      ? sel.max !== ""
        ? `${sel.max}+`
        : ""
      : sel.min !== "" && sel.max !== ""
        ? `${sel.min}–${sel.max}`
        : sel.min !== ""
          ? `≥${sel.min}`
          : sel.max !== ""
            ? `≤${sel.max}`
            : "";
    return `${t("optionSlotLabel", { slot: index + 1 })} · ${stat?.label ?? sel.statCode}${range ? " " + range : ""}`;
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      {isBuy && <p className="text-xs italic text-ro-text-muted">{t("buyOptionsHint")}</p>}
      <div className="relative">
        <div className="flex flex-wrap gap-1.5">
          {statsBySlot.map((stats, index) => {
            if (stats.length === 0) return null;
            const isSet = selections[index].statCode !== "";
            const active = editing === index;
            const toggle = () => setEditing(active ? null : index);
            return isSet ? (
              <span
                key={index}
                className={`inline-flex items-center gap-1 rounded border py-0.5 pl-1.5 pr-0.5 text-[0.7rem] text-ro-accent ${
                  active ? "border-ro-accent bg-ro-accent/20" : "border-ro-accent/40 bg-ro-accent/10"
                }`}
              >
                <button type="button" onClick={toggle} className="max-w-[11rem] truncate">
                  {chipText(index)}
                </button>
                <button
                  type="button"
                  onClick={() => onClear(index)}
                  aria-label={t("removeValue", { value: chipText(index) })}
                  className="grid h-3.5 w-3.5 place-items-center rounded-sm hover:bg-ro-accent/25"
                >
                  <X size={11} aria-hidden />
                </button>
              </span>
            ) : (
              <button
                key={index}
                type="button"
                onClick={toggle}
                className={`inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[0.7rem] ${
                  active
                    ? "border-ro-accent text-ro-accent"
                    : "border-ro-panel-border text-ro-text-muted hover:border-ro-accent hover:text-ro-accent"
                }`}
              >
                <Plus size={11} aria-hidden />
                {t("optionSlotLabel", { slot: index + 1 })}
              </button>
            );
          })}
        </div>

        {editing !== null &&
          (() => {
            const index = editing;
            const stats = statsBySlot[index];
            const sel = selections[index];
            const selectedStat = stats.find((s) => s.statCode === sel.statCode);
            const isMinOutOfRange =
              selectedStat !== undefined &&
              sel.min !== "" &&
              (sel.min < selectedStat.minValue || sel.min > selectedStat.maxValue);
            const isMaxOutOfRange =
              selectedStat !== undefined &&
              sel.max !== "" &&
              (sel.max < selectedStat.minValue || sel.max > selectedStat.maxValue);
            return (
              // Popover anclado a la fila (left-0 + w-full), así no desborda el panel.
              <div
                ref={popoverRef}
                className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-ro-panel-border bg-ro-panel-alt p-2 shadow-lg"
              >
                <select
                  value={sel.statCode}
                  onChange={(e) => onStatChange(index, e.target.value)}
                  className={`w-full ${selectClass}`}
                >
                  <option value="">{t("optionPlaceholder", { slot: index + 1 })}</option>
                  {stats.map((s) => (
                    <option key={s.statCode} value={s.statCode}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {sel.statCode && (
                  <div className="mt-2 flex items-center gap-2">
                    {!isBuy && (
                      <input
                        type="number"
                        placeholder={selectedStat ? String(selectedStat.minValue) : t("min")}
                        value={sel.min}
                        onChange={(e) => onMinChange(index, e.target.value)}
                        className={`w-full ${inputBaseClass}`}
                        style={isMinOutOfRange ? { borderColor: "#dc2626" } : undefined}
                      />
                    )}
                    <input
                      type="number"
                      placeholder={
                        selectedStat
                          ? isBuy
                            ? `${selectedStat.minValue}-${selectedStat.maxValue}`
                            : String(selectedStat.maxValue)
                          : isBuy
                            ? t("value")
                            : t("max")
                      }
                      value={sel.max}
                      onChange={(e) => onMaxChange(index, e.target.value)}
                      className={`w-full ${inputBaseClass}`}
                      style={isMaxOutOfRange ? { borderColor: "#dc2626" } : undefined}
                    />
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
