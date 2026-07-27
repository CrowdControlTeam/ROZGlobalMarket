"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export function Sidebar({
  side,
  open,
  onClose,
  title,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute top-0 h-full w-72 max-w-[85vw] bg-ro-panel text-ro-text shadow-xl transition-transform duration-200 ${
          side === "left"
            ? `left-0 border-r-4 border-ro-panel-border ${open ? "translate-x-0" : "-translate-x-full"}`
            : `right-0 border-l-4 border-ro-panel-border ${open ? "translate-x-0" : "translate-x-full"}`
        }`}
      >
        <div className="flex items-center justify-between border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-3">
          <h2 className="font-heading text-xs text-ro-gold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-lg leading-none text-ro-gold hover:text-ro-text-light"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
