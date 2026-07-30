"use client";

import { useSyncExternalStore, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ListingCardPatch } from "@/lib/listing-card";

// Store módulo-singleton que comunica el DETALLE (que muta) con el GRID (que
// pinta), aunque vivan en slots de ruta distintos. Tras cada compra/venta, el
// detalle publica el patch que devolvió la server action; el grid se suscribe y
// lo fusiona sobre la card afectada, esté en la página que esté. Se limpia al
// remontar el grid (cambio de filtro = nueva carga autoritativa del servidor),
// lo que además acota la memoria. Ver el porqué en la conversación de diseño.
const patches = new Map<string, ListingCardPatch>();
const listeners = new Set<() => void>();
// Copia inmutable para useSyncExternalStore (referencia estable entre emits).
let snapshot: ReadonlyMap<string, ListingCardPatch> = new Map();

function emit() {
  snapshot = new Map(patches);
  for (const l of listeners) l();
}

export function applyListingPatch(patch: ListingCardPatch) {
  patches.set(patch.listingId, patch);
  emit();
}

export function clearListingPatches() {
  if (patches.size === 0) return;
  patches.clear();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useListingPatches(): ReadonlyMap<string, ListingCardPatch> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

// Para el detalle: aplica el patch devuelto por la action y refresca el server
// component del detalle (Disponibles/ofertas + reset del input vía su `key`).
export function useListingSync() {
  const router = useRouter();
  return useCallback(
    (patch: ListingCardPatch) => {
      applyListingPatch(patch);
      router.refresh();
    },
    [router],
  );
}
