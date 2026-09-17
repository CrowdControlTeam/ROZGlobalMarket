"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SkillTreePreview } from "./SkillTreePreview";

// Modal de solo lectura con el/los árbol(es) de skills de una build (a partir del
// código exportado). Mismo shell que SkillPlannerModal: overlay centrado,
// scrollable, cierre por X, click fuera o Escape. Se abre bajo demanda desde el
// detalle de la build para no tener el árbol siempre desplegado.
export function SkillTreeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const t = useTranslations("builds.detail");
  const tCommon = useTranslations("common");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-ro-panel-border bg-ro-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ro-panel-border px-4 py-3">
          <h3 className="font-heading text-sm text-ro-text">{t("skills")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-ro-text-muted hover:text-ro-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <SkillTreePreview code={code} />
        </div>
      </div>
    </div>
  );
}
