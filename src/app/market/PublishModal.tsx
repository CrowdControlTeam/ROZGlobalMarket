"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PublishForm } from "./PublishForm";
import type { PublicationType } from "./new/NewPublicationForm";

// Shell del modal de publicar: overlay centrado con backdrop oscuro sobre el
// mercado (montado detrás). Se cierra con ✕, Escape o clic en el backdrop, vía
// router.back() —se llega aquí navegando (Link push a ?publish=), así que
// "atrás" deja la URL sin el query param— igual que DetailPanel. En móvil ocupa
// (casi) toda la pantalla; en desktop es una tarjeta ancha centrada.
export function PublishModal({
  recognitionEnabled,
  initialType,
}: {
  recognitionEnabled: boolean;
  initialType: PublicationType;
}) {
  const router = useRouter();
  const t = useTranslations();

  function close() {
    router.back();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div onClick={close} aria-hidden className="fixed inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.newPublication")}
        className="relative z-10 flex max-h-full w-full flex-col overflow-hidden bg-ro-panel text-ro-text shadow-xl sm:max-w-3xl sm:rounded-2xl sm:border sm:border-ro-panel-border"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ro-panel-border bg-ro-panel-header px-4 py-3">
          <h2 className="font-heading text-base text-ro-text">{t("nav.newPublication")}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="text-lg leading-none text-ro-text-muted hover:text-ro-text"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PublishForm recognitionEnabled={recognitionEnabled} initialType={initialType} onClose={close} />
        </div>
      </div>
    </div>
  );
}
