"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PublishForm, type EditListingData } from "./PublishForm";
import type { PublicationType } from "./new/NewPublicationForm";

// Shell del modal de publicar: overlay centrado con backdrop oscuro sobre el
// mercado (montado detrás). Se cierra con ✕, Escape o clic en el backdrop, vía
// router.back() —se llega aquí navegando (Link push a ?publish=), así que
// "atrás" deja la URL sin el query param— igual que DetailPanel. En móvil ocupa
// (casi) toda la pantalla; en desktop es una tarjeta ancha centrada.
export function PublishModal({
  recognitionEnabled,
  initialType,
  editListing,
}: {
  recognitionEnabled: boolean;
  initialType: PublicationType;
  editListing?: EditListingData;
}) {
  const router = useRouter();
  const t = useTranslations();
  const title = editListing ? t("market.form.editTitle") : t("home.tiles.publish.label");

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
      <div onClick={close} aria-hidden className="fixed inset-0 bg-black/50 motion-safe:animate-[ro-fade-in_150ms_ease-out]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Ancho adaptativo: ancho para el layout de 2 columnas (escáner + form)
        // cuando el reconocimiento está disponible; estrecho para solo-formulario
        // cuando no lo está.
        className={`relative z-10 flex max-h-full w-full flex-col overflow-hidden bg-ro-panel text-ro-text shadow-xl motion-safe:animate-[ro-modal-in_180ms_ease-out] sm:rounded-2xl sm:border sm:border-ro-panel-border ${
          recognitionEnabled ? "sm:max-w-4xl" : "sm:max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ro-panel-border bg-ro-panel-header px-4 py-3">
          <h2 className="font-heading text-base text-ro-text">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="text-lg leading-none text-ro-text-muted hover:text-ro-text"
          >
            ✕
          </button>
        </div>
        {/* El propio form gestiona su scroll interno y su pie fijo (flex-1). */}
        <PublishForm recognitionEnabled={recognitionEnabled} initialType={initialType} onClose={close} editListing={editListing} />
      </div>
    </div>
  );
}
