"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  Search,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Layers,
  Bookmark,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMarketSearch } from "./marketSearchStore";

// Menús de las búsquedas guardadas (solo desktop, la barra de pestañas es
// `hidden sm:block`). Dos piezas:
//  - LupaMenu: el desplegable del icono de la lupa, SOLO para CARGAR (un filtro
//    concreto vía submenú, o todos).
//  - TabActionsMenu: menú contextual (click derecho) de una pestaña, para
//    guardar / renombrar / actualizar / borrar de la DB.

// Cierra al hacer click fuera del `ref` o con Escape.
function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ref]);
}

const ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ro-text transition-colors hover:bg-ro-panel-alt disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ro-text-muted/50";

export function LupaMenu() {
  const t = useTranslations("market.searchTabs");
  const { savedSearches, openSaved, openAllSaved } = useMarketSearch();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const none = savedSearches.length === 0;

  const close = () => {
    setOpen(false);
    setSubmenu(false);
  };
  useDismiss(open, close, ref);

  return (
    // items-end + border-b para que la línea de acento continúe bajo la lupa
    // (fija) y case con la del track de pestañas; pr para separar de la 1ª pestaña.
    <div ref={ref} className="relative flex shrink-0 items-end border-b-2 border-ro-accent pr-1">
      <button
        type="button"
        aria-label={t("menuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text"
      >
        <Search size={13} />
        <ChevronDown size={11} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] rounded-lg border border-ro-panel-border bg-ro-panel py-1 shadow-lg"
        >
          {/* Cargar filtro concreto: submenú a la derecha con la lista guardada. */}
          <div
            className="relative"
            onMouseEnter={() => !none && setSubmenu(true)}
            onMouseLeave={() => setSubmenu(false)}
          >
            <button type="button" role="menuitem" disabled={none} className={`${ITEM_CLASS} justify-between`}>
              <span className="flex items-center gap-2">
                <FolderOpen size={14} aria-hidden />
                {t("load")}
              </span>
              {!none && <ChevronRight size={13} className="text-ro-text-muted" aria-hidden />}
            </button>
            {submenu && !none && (
              <div
                role="menu"
                className="absolute left-full top-0 z-40 -mt-1 ml-0.5 max-h-[60vh] min-w-[12rem] overflow-y-auto rounded-lg border border-ro-panel-border bg-ro-panel py-1 shadow-lg"
              >
                {savedSearches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      openSaved(s);
                      close();
                    }}
                    className="block w-full truncate px-3 py-1.5 text-left text-sm text-ro-text transition-colors hover:bg-ro-panel-alt"
                    title={s.name}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cargar todas: una pestaña por búsqueda guardada. */}
          <button
            type="button"
            role="menuitem"
            disabled={none}
            onClick={() => {
              openAllSaved();
              close();
            }}
            className={ITEM_CLASS}
          >
            <Layers size={14} aria-hidden />
            {t("loadAll")}
          </button>

          {none && <p className="px-3 py-1.5 text-xs text-ro-text-muted">{t("noneSaved")}</p>}
        </div>
      )}
    </div>
  );
}

// Menú contextual (click derecho) de una pestaña. Posicionado en el cursor y
// portaleado a body. Las acciones que necesitan nombre (guardar/renombrar) las
// resuelve el padre con un input inline; aquí solo se disparan callbacks.
export function TabActionsMenu({
  x,
  y,
  isSaved,
  isModified,
  onClose,
  onSave,
  onRename,
  onUpdate,
  onDelete,
}: {
  x: number;
  y: number;
  isSaved: boolean;
  isModified: boolean;
  onClose: () => void;
  onSave: () => void;
  onRename: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("market.searchTabs");
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);

  if (typeof window === "undefined") return null;
  // Clamp para no desbordar el viewport (menú ~11rem ancho).
  const left = Math.min(x, window.innerWidth - 190);
  const top = Math.min(y, window.innerHeight - 170);

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ top, left }}
      className="fixed z-[70] min-w-[11rem] rounded-lg border border-ro-panel-border bg-ro-panel py-1 shadow-xl"
    >
      {!isSaved ? (
        <MenuItem icon={<Bookmark size={14} aria-hidden />} label={t("save")} onClick={() => run(onSave)} />
      ) : (
        <>
          <MenuItem icon={<Pencil size={14} aria-hidden />} label={t("rename")} onClick={() => run(onRename)} />
          {isModified && (
            <MenuItem icon={<RefreshCw size={14} aria-hidden />} label={t("update")} onClick={() => run(onUpdate)} />
          )}
          <MenuItem
            icon={<Trash2 size={14} aria-hidden />}
            label={t("deleteSaved")}
            danger
            onClick={() => run(onDelete)}
          />
        </>
      )}
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-ro-panel-alt ${
        danger ? "text-red-600" : "text-ro-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
