"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export type KebabItem = { label: string; onSelect: () => void; icon?: ReactNode };

// Menú contextual (kebab ⋮) reutilizable: botón de tres puntos + desplegable.
// Se cierra al hacer click fuera o con Escape. Pensado para posicionarse en la
// esquina de una tarjeta (contenedor relativo).
export function KebabMenu({ label, items }: { label: string; items: KebabItem[] }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-md text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text"
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel py-1 shadow-lg"
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ro-text transition-colors hover:bg-ro-panel-alt"
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
