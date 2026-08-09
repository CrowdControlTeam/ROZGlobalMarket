"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";

// Selector múltiple para el panel de filtros. A diferencia de RoleMultiSelect
// (que serializa a inputs ocultos para un FormData), este es CONTROLADO: recibe
// los valores elegidos y notifica el nuevo array al store vía onChange. El
// orden del array devuelto respeta el de `options` (canónico), para que la CSV
// resultante sea estable y no provoque rebotes estado→URL→estado.
//
// UX: el desplegable sirve para AÑADIR (esconde listas largas —tipo de arma
// tiene 22 valores—); los seleccionados salen debajo como CHIPS con una X para
// quitarlos de un solo clic, sin tener que reabrir el desplegable.
export function MultiSelectFilter({
  options,
  selected,
  onChange,
  disabled = false,
  placeholder,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const t = useTranslations("market");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedSet = new Set(selected);
  // Devuelve siempre en orden de `options` (canónico) para una salida estable.
  function emit(next: Set<string>) {
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }
  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    emit(next);
  }
  function remove(value: string) {
    const next = new Set(selectedSet);
    next.delete(value);
    emit(next);
  }

  // Chips en el orden de `options` (no de selección) para que su disposición sea
  // estable al añadir/quitar.
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-ro-panel-border bg-ro-panel-alt px-2 py-1.5 text-left text-sm text-ro-text focus:border-ro-accent focus:outline-none disabled:opacity-40"
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOptions.length === 0 ? (
            <span className="text-ro-text-muted">{placeholder}</span>
          ) : (
            t("filters.addMore")
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-ro-text-muted" aria-hidden />
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-ro-panel-border bg-ro-panel-alt p-1 shadow-lg">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ro-accent/15"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-ro-accent"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
      {selectedOptions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className={`inline-flex items-center gap-1 rounded border border-ro-accent/40 bg-ro-accent/10 py-0.5 pl-1.5 text-[0.7rem] text-ro-accent ${
                disabled ? "pr-1.5 opacity-40" : "pr-0.5"
              }`}
            >
              {o.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(o.value)}
                  aria-label={t("filters.removeValue", { value: o.label })}
                  className="grid h-3.5 w-3.5 place-items-center rounded-sm hover:bg-ro-accent/25"
                >
                  <X size={11} aria-hidden />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
