"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Selector múltiple para el panel de filtros. A diferencia de RoleMultiSelect
// (que serializa a inputs ocultos para un FormData), este es CONTROLADO: recibe
// los valores elegidos y notifica el nuevo array al store vía onChange. El
// orden del array devuelto respeta el de `options` (canónico), para que la CSV
// resultante sea estable y no provoque rebotes estado→URL→estado.
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
  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Reordenar según `options` para una salida canónica y determinista.
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }

  // Etiquetas en el orden de `options` (no de selección) para un resumen estable.
  const selectedLabels = options.filter((o) => selectedSet.has(o.value)).map((o) => o.label);

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
          {selectedLabels.length === 0 ? (
            <span className="text-ro-text-muted">{placeholder}</span>
          ) : (
            selectedLabels.join(", ")
          )}
        </span>
        {selectedSet.size > 0 && <span className="shrink-0 text-ro-text-muted">({selectedSet.size})</span>}
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
    </div>
  );
}
