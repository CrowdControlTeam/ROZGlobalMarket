"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { inputClass } from "@/lib/ui";

// Selector múltiple de roles con panel desplegable de checkboxes. El disparador
// muestra los roles elegidos separados por coma (con ellipsis si no caben) y el
// total entre paréntesis — "rol1, rol2, rol3, ro… (7)" — para que su ancho no
// crezca de forma impredecible por muchos roles que tenga el servidor. Los
// valores seleccionados viajan en inputs ocultos con `name` (siempre en el DOM,
// esté el panel abierto o no), así que funciona con el FormData del server
// action igual que los checkboxes sueltos que sustituye.
export function RoleMultiSelect({
  name,
  roles,
  defaultSelected,
  onChange,
}: {
  // `name` opcional (ver ToggleSwitch): solo hace falta en forms de servidor.
  name?: string;
  roles: { id: string; name: string }[];
  defaultSelected: string[];
  // Autoguardado: se llama con la lista completa de ids al cambiar la selección.
  onChange?: (ids: string[]) => void;
}) {
  const t = useTranslations("admin.access");
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));
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

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onChange?.([...next]);
  }

  // Nombres en el orden del listado del servidor (no de selección) para que el
  // resumen sea estable.
  const selectedNames = roles.filter((r) => selected.has(r.id)).map((r) => r.name);

  return (
    <div ref={ref} className="relative">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedNames.length === 0 ? (
            <span className="text-ro-text-muted">{t("noneSelected")}</span>
          ) : (
            selectedNames.join(", ")
          )}
        </span>
        {selected.size > 0 && <span className="shrink-0 text-ro-text-muted">({selected.size})</span>}
        <ChevronDown size={16} className="shrink-0 text-ro-text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-ro-panel-border bg-ro-panel-alt p-1 shadow-lg">
          {roles.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-ro-text-muted">{t("noRoles")}</p>
          ) : (
            roles.map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ro-accent/15"
              >
                <input
                  type="checkbox"
                  checked={selected.has(role.id)}
                  onChange={() => toggle(role.id)}
                  className="accent-ro-accent"
                />
                {role.name}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
