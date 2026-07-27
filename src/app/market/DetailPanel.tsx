"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Envoltorio visual de la ficha de listing (panel lateral en desktop,
// bottom sheet en móvil) — usado como overlay sobre /market (slot @detail,
// activado por ?listing=<id> — ver MarketResults.listingHref y
// @detail/DetailSlot.tsx), manteniendo el mercado montado detrás. El
// acceso directo/enlace compartido (market/[id]/page.tsx) usa un layout de
// página normal en vez de este panel.
// A diferencia de Sidebar.tsx (menú hamburguesa), esto NO es un modal: sin
// fondo oscurecido y sin cierre al hacer clic fuera. Se cierra con la X,
// Escape, o (en móvil) deslizando el panel hacia abajo; `close()` usa
// router.back() porque se llega aquí navegando (Link push, ver
// listingHref), así que "atrás" ya deja la URL correcta sin el query param.
export function DetailPanel({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  // Entra deslizándose (desde abajo en móvil, desde la derecha en
  // desktop) en vez de aparecer ya en su sitio — mismo efecto que Sidebar,
  // aquí a mano porque no hay un `open` controlado desde fuera: el panel
  // solo existe mientras la ruta interceptada está montada.
  useEffect(() => {
    setMounted(true);
  }, []);

  function close() {
    router.back();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    startYRef.current = e.clientY;
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  }
  function handlePointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // Umbral de 100px arrastrados hacia abajo para considerar el gesto un
    // cierre intencional; si no, el panel vuelve a su sitio.
    if (dragY > 100) {
      close();
    } else {
      setDragY(0);
    }
  }

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-40 flex h-auto max-h-[60vh] w-full flex-col overflow-hidden rounded-t-2xl border-t-4 border-ro-panel-border bg-ro-panel text-ro-text shadow-xl transition-transform duration-200 md:left-auto md:top-0 md:h-full md:max-h-none md:w-[420px] md:max-w-[85vw] md:rounded-none md:rounded-l-2xl md:border-l-4 md:border-t-0 ${
        mounted ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full"
      }`}
      style={
        draggingRef.current
          ? { transform: `translateY(${dragY}px)`, transitionDuration: "0ms" }
          : undefined
      }
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2 active:cursor-grabbing md:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-ro-panel-border" />
      </div>
      <div className="flex shrink-0 items-center justify-end border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-2 md:border-t-0">
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="text-lg leading-none text-ro-gold hover:text-ro-text-light"
        >
          ✕
        </button>
      </div>
      <div className="overflow-y-auto p-3">{children}</div>
    </div>
  );
}
