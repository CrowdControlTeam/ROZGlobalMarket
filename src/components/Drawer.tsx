"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type DrawerSide = "left" | "right" | "bottom";

// Panel modal deslizante. Base compartida del menú de usuario y el mensaje de
// contacto, y —vía side="bottom" o mobileSheet— de las hojas inferiores de
// móvil del rediseño (filtros en Fase 4, detalle en Fase 6). Antes se llamaba
// Sidebar; generalizado a drawer/bottom-sheet.
export function Drawer({
  side = "right",
  open,
  onClose,
  title,
  children,
  mobileSheet = false,
}: {
  side?: DrawerSide;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // En móvil (< sm) se comporta como hoja inferior aunque `side` sea
  // left/right; en sm+ respeta `side`. Ignorado si side === "bottom".
  mobileSheet?: boolean;
}) {
  const t = useTranslations("common");
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Clases de posición/tamaño/borde y el transform en estado cerrado, por
  // variante. Al abrir se resetea a translate 0 en ambos ejes (el eje que
  // aplique según la variante es el que anima).
  const bottomBox =
    "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t border-ro-panel-border";
  const variant =
    side === "bottom"
      ? { box: bottomBox, closed: "translate-y-full" }
      : mobileSheet
        ? {
            // Hoja inferior en móvil; drawer lateral en sm+.
            box: `${bottomBox} sm:inset-x-auto sm:top-0 sm:h-full sm:max-h-none sm:w-72 sm:max-w-[85vw] sm:rounded-none sm:border-t-0 ${
              side === "right" ? "sm:right-0 sm:border-l" : "sm:left-0 sm:border-r"
            }`,
            closed:
              side === "right"
                ? "translate-y-full sm:translate-y-0 sm:translate-x-full"
                : "translate-y-full sm:translate-y-0 sm:-translate-x-full",
          }
        : {
            box: `top-0 h-full w-72 max-w-[85vw] ${
              side === "right" ? "right-0 border-l border-ro-panel-border" : "left-0 border-r border-ro-panel-border"
            }`,
            closed: side === "right" ? "translate-x-full" : "-translate-x-full",
          };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute flex flex-col bg-ro-panel text-ro-text shadow-xl transition-transform duration-200 ${variant.box} ${
          open ? "translate-x-0 translate-y-0" : variant.closed
        }`}
      >
        <div className="flex items-center justify-between border-b border-ro-panel-border bg-ro-panel-header px-4 py-3">
          <h2 className="text-sm font-semibold text-ro-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-lg leading-none text-ro-text-muted hover:text-ro-text"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
