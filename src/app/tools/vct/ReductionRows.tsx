"use client";

import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { buttonClass, inputBaseClass, inputClass } from "@/lib/ui";

// Una fila de reducción: fuente (texto, opcional, solo referencia del usuario) +
// valor en %. El id es local para el key de React.
export type ReductionRow = { id: string; label: string; value: string };

export function newRow(): ReductionRow {
  return { id: crypto.randomUUID(), label: "", value: "" };
}

// Lista editable de reducciones (nombre + %) con añadir/quitar y suma. La usan
// las secciones de equipo/cartas y de skills/buffs (mismo patrón "Sum of …").
export function ReductionRows({
  rows,
  onChange,
  sum,
}: {
  rows: ReductionRow[];
  onChange: (rows: ReductionRow[]) => void;
  sum: number;
}) {
  const t = useTranslations("tools.vct");

  function update(id: string, patch: Partial<ReductionRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <input
            type="text"
            value={r.label}
            onChange={(e) => update(r.id, { label: e.target.value })}
            placeholder={t("rows.namePlaceholder")}
            aria-label={t("rows.namePlaceholder")}
            className={inputClass}
          />
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={r.value}
              onChange={(e) => update(r.id, { value: e.target.value })}
              placeholder="0"
              aria-label={t("rows.valueLabel")}
              className={`w-20 text-right ${inputBaseClass}`}
            />
            <span className="text-sm text-ro-text-muted">%</span>
          </div>
          <button
            type="button"
            onClick={() => remove(r.id)}
            aria-label={t("rows.remove")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-ro-text-muted transition-colors hover:bg-ro-panel-border/40 hover:text-ro-text"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange([...rows, newRow()])}
          className={buttonClass("outline")}
        >
          <Plus size={16} aria-hidden />
          {t("rows.add")}
        </button>
        <p className="text-sm text-ro-text-muted">
          {t("rows.sum")}: <span className="font-semibold text-ro-text">{sum}%</span>
        </p>
      </div>
    </div>
  );
}
