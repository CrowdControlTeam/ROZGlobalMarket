"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { fetchDbItemDetail } from "@/app/db/items/actions";
import { ItemTooltip } from "@/app/db/items/ItemTooltip";
import type { DbItemDetail } from "@/lib/db-items";

// Icono de item reutilizable (sustituye los <Image src={iconUrl}> sueltos). Su
// gracia: al hacer CLICK DERECHO (o LONG-PRESS en táctil) muestra la ficha del
// item estilo juego (ItemTooltip) en un popover flotante junto al cursor. El
// click izquierdo normal no se toca: sigue haciendo lo que haga su contenedor.
export type ItemIconData = { id: string; name: string; iconUrl: string };

// Cache de detalles por id, compartida entre todas las instancias: el click
// derecho no re-fetchea un item ya visto.
const detailCache = new Map<string, DbItemDetail>();
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

export function ItemIcon({
  item,
  width,
  height,
  className,
  alt,
  options,
  refine,
}: {
  item: ItemIconData;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  // Random options ya formateadas (p. ej. "ATK +28") de la instancia concreta
  // (un listing), para mostrarlas en la preview como en el juego. Opcional: el
  // item genérico no las tiene.
  options?: string[];
  // Refine de la instancia (un listing), para el prefijo "+N" del nombre.
  refine?: number;
}) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Tras un long-press marcamos que hay que "tragarse" el click que llega
  // después, para no disparar además la acción del contenedor (abrir detalle…).
  const suppressClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }
  useEffect(() => () => clearTimer(), []);

  function openAt(x: number, y: number) {
    clearTimer();
    setAnchor({ x, y });
  }

  function handleContextMenu(e: React.MouseEvent) {
    // Click derecho (desktop) y long-press en Android (que emite contextmenu).
    e.preventDefault();
    e.stopPropagation();
    openAt(e.clientX, e.clientY);
  }

  function handlePointerDown(e: React.PointerEvent) {
    suppressClickRef.current = false;
    if (e.pointerType !== "touch") return;
    // Táctil (iOS no emite contextmenu): long-press manual.
    const x = e.clientX;
    const y = e.clientY;
    startRef.current = { x, y };
    clearTimer();
    timerRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      openAt(x, y);
    }, LONG_PRESS_MS);
  }
  function handlePointerMove(e: React.PointerEvent) {
    const start = startRef.current;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL_PX) clearTimer();
  }
  function handleClick(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <>
      <Image
        src={item.iconUrl}
        alt={alt ?? item.name}
        width={width}
        height={height}
        className={className}
        draggable={false}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={handleClick}
        style={{ WebkitTouchCallout: "none", userSelect: "none", touchAction: "manipulation" }}
      />
      {anchor && (
        <ItemPreviewPopover
          item={item}
          options={options}
          refine={refine}
          x={anchor.x}
          y={anchor.y}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

// Popover flotante con la ficha del item, posicionado junto al cursor y acotado
// al viewport. Portalado a body para escapar del overflow/stacking de las cards.
function ItemPreviewPopover({
  item,
  options,
  refine,
  x,
  y,
  onClose,
}: {
  item: ItemIconData;
  options?: string[];
  refine?: number;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<DbItemDetail | null>(() => detailCache.get(item.id) ?? null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x + 14, top: y + 14 });

  // Detalle (una vez, cacheado).
  useEffect(() => {
    if (detail) return;
    let alive = true;
    fetchDbItemDetail(item.id).then((d) => {
      if (alive && d) {
        detailCache.set(item.id, d);
        setDetail(d);
      }
    });
    return () => {
      alive = false;
    };
  }, [item.id, detail]);

  // Coloca junto al cursor; si se sale, se voltea al otro lado. Se recalcula al
  // llegar el detalle (cambia de tamaño respecto al estado de carga).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let left = x + 14;
    let top = y + 14;
    if (left + r.width > window.innerWidth - pad) left = Math.max(pad, x - r.width - 14);
    if (top + r.height > window.innerHeight - pad) top = Math.max(pad, y - r.height - 14);
    setPos({ left, top });
  }, [x, y, detail]);

  // Cierra al pulsar fuera (pointerdown, para no cerrarse con los eventos de
  // ratón sintéticos del propio long-press táctil), Escape o al hacer scroll.
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
      className="w-[20rem] max-w-[calc(100vw-1rem)] rounded-lg border-2 border-ro-panel-border bg-ro-panel p-3 shadow-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {detail ? (
        <ItemTooltip item={detail} options={options} refine={refine} />
      ) : (
        <div className="flex items-center gap-2 text-xs text-ro-text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-ro-panel-border border-t-ro-accent" />
        </div>
      )}
    </div>,
    document.body,
  );
}
