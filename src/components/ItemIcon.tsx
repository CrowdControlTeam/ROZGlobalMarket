"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { fetchDbItemDetail } from "@/app/db/items/actions";
import { ItemTooltip } from "@/app/db/items/ItemTooltip";
import type { DbItemDetail } from "@/lib/db-items";
import { usePreviewTrigger, PreviewShell } from "./PreviewPopover";

// Icono de item reutilizable (sustituye los <Image src={iconUrl}> sueltos). Su
// gracia: al hacer CLICK DERECHO (o LONG-PRESS en táctil) muestra la ficha del
// item estilo juego (ItemTooltip) en un popover flotante junto al cursor. El
// click izquierdo normal no se toca: sigue haciendo lo que haga su contenedor.
export type ItemIconData = { id: string; name: string; iconUrl: string };

// Cache de detalles por id, compartida entre todas las instancias: el click
// derecho no re-fetchea un item ya visto.
const detailCache = new Map<string, DbItemDetail>();

export function ItemIcon({
  item,
  width,
  height,
  className,
  alt,
  options,
  refine,
  tags,
}: {
  item: ItemIconData;
  width: number;
  height: number;
  className?: string;
  alt?: string;
  // Random options ya formateadas (p. ej. "ATK +28") de la instancia concreta
  // (un listing / un BiS), para mostrarlas en la preview como en el juego.
  options?: string[];
  // Refine de la instancia, para el prefijo "+N" del nombre.
  refine?: number;
  // Etiquetas extra (rol/job de un BiS), para mostrarlas bajo la ficha.
  tags?: string[];
}) {
  const { anchor, close, triggerProps } = usePreviewTrigger();
  return (
    <>
      <Image
        src={item.iconUrl}
        alt={alt ?? item.name}
        width={width}
        height={height}
        className={className}
        draggable={false}
        {...triggerProps}
      />
      {anchor && (
        <PreviewShell x={anchor.x} y={anchor.y} onClose={close}>
          <ItemPreviewContent item={item} options={options} refine={refine} tags={tags} />
        </PreviewShell>
      )}
    </>
  );
}

// Contenido de la preview de un item: busca el detalle (cacheado por id) y pinta
// la ficha; mientras carga, un spinner.
function ItemPreviewContent({
  item,
  options,
  refine,
  tags,
}: {
  item: ItemIconData;
  options?: string[];
  refine?: number;
  tags?: string[];
}) {
  const [detail, setDetail] = useState<DbItemDetail | null>(() => detailCache.get(item.id) ?? null);

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

  return detail ? (
    <ItemTooltip item={detail} options={options} refine={refine} tags={tags} />
  ) : (
    <div className="flex items-center gap-2 text-xs text-ro-text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ro-panel-border border-t-ro-accent" />
    </div>
  );
}
