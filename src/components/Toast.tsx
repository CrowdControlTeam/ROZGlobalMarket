"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

// Notificación transitoria (toast) mínima: fija abajo-centro, portaleada a
// document.body y con autodescarte. Se renderiza solo cuando hay `message`
// (siempre tras una acción del usuario, nunca en SSR), así que createPortal
// nunca corre en el servidor. Sin cola: un aviso puntual a la vez.
export function Toast({
  message,
  onDismiss,
  duration = 3500,
}: {
  message: string;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [onDismiss, duration]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <div
        role="status"
        onClick={onDismiss}
        className="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel px-4 py-2.5 text-sm text-ro-text shadow-xl"
      >
        <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-hidden />
        <span>{message}</span>
      </div>
    </div>,
    document.body,
  );
}
