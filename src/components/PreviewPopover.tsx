"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

// Disparador de una preview flotante: CLICK DERECHO (desktop; en Android el
// long-press emite contextmenu) o LONG-PRESS manual en táctil (iOS no emite
// contextmenu). Devuelve el ancla (posición del cursor) y los props a poner en
// el elemento disparador. El onClick "se traga" el click que sigue a un
// long-press para no disparar además la acción del contenedor.
export function usePreviewTrigger() {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }
  useEffect(() => () => clearTimer(), []);

  const triggerProps = {
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      clearTimer();
      setAnchor({ x: e.clientX, y: e.clientY });
    },
    onPointerDown(e: React.PointerEvent) {
      suppressClickRef.current = false;
      if (e.pointerType !== "touch") return;
      const x = e.clientX;
      const y = e.clientY;
      startRef.current = { x, y };
      clearTimer();
      timerRef.current = setTimeout(() => {
        suppressClickRef.current = true;
        clearTimer();
        setAnchor({ x, y });
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      const s = startRef.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_CANCEL_PX) clearTimer();
    },
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
    onPointerCancel: clearTimer,
    onClick(e: React.MouseEvent) {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    style: {
      WebkitTouchCallout: "none",
      userSelect: "none",
      touchAction: "manipulation",
    } as React.CSSProperties,
  };

  return { anchor, close: () => setAnchor(null), triggerProps };
}

// Cáscara del popover: portalada a body (escapa del overflow/stacking de las
// cards), posicionada junto al cursor y acotada al viewport — se reposiciona si
// el contenido cambia de tamaño (p. ej. spinner → ficha). Cierra al pulsar fuera
// (pointerdown, para no cerrarse con los eventos de ratón sintéticos del propio
// long-press táctil), Escape o scroll.
export function PreviewShell({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x + 14, top: y + 14 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function reposition() {
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const pad = 8;
      let left = x + 14;
      let top = y + 14;
      if (left + r.width > window.innerWidth - pad) left = Math.max(pad, x - r.width - 14);
      if (top + r.height > window.innerHeight - pad) top = Math.max(pad, y - r.height - 14);
      setPos({ left, top });
    }
    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(el);
    return () => ro.disconnect();
  }, [x, y]);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScroll() {
      onClose();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 60 }}
      className="max-h-[calc(100vh-1rem)] w-[20rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border-2 border-ro-panel-border bg-ro-panel p-3 shadow-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}
