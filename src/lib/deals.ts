import type { DealStatus } from "@/db/schema";

// Núcleo del rediseño de listings: la contabilidad de un listing (cuánto se ha
// vendido/reservado, cuánto queda) se DERIVA de sus filas Deal — no hay
// contadores denormalizados en Listing. Aquí viven las funciones puras de ese
// cálculo y la regla de cierre; el orquestado transaccional (crear/aceptar
// deals con bloqueo de fila) se añade con el primer flujo que las use.

export type ListingQuantities = {
  // Σ quantity de los Deal ACCEPTED: lo ya cerrado (vendido/comprado/
  // intercambiado/reclamado).
  sold: number;
  // Σ quantity de los Deal PENDING. Solo "retiene" stock en los modos de
  // RESERVA (venta a precio fijo, regalo reclamable); en los de OFERTAS
  // competitivas (sin precio, trade) las PENDING no bloquean —el poster elige—,
  // así que ahí el caller no debe restar `reserved` de lo disponible.
  reserved: number;
  // Disponible. null = ilimitado (Listing.quantity null, p.ej. compra de
  // materiales). Si el listing tiene tope: quantity - sold - reserved (nunca
  // negativo).
  available: number | null;
};

// `deals` son los del listing (todos sus estados). `listingQuantity` null =
// ilimitado.
export function computeListingQuantities(
  listingQuantity: number | null,
  deals: readonly { status: DealStatus; quantity: number }[],
): ListingQuantities {
  let sold = 0;
  let reserved = 0;
  for (const d of deals) {
    if (d.status === "ACCEPTED") sold += d.quantity;
    else if (d.status === "PENDING") reserved += d.quantity;
  }
  const available =
    listingQuantity === null ? null : Math.max(0, listingQuantity - sold - reserved);
  return { sold, reserved, available };
}

// Disponible para reservar/ofertar/reclamar: null = ILIMITADO (Listing.quantity
// null, p.ej. compra de materiales "los que tengas"). Si hay tope: cantidad −
// vendido − reservado (nunca negativo).
export function availableFrom(
  quantity: number | null,
  sold: number,
  reserved: number,
): number | null {
  return quantity === null ? null : Math.max(0, quantity - sold - reserved);
}

// ¿Se agotó el stock? Solo los listings con tope (quantity no null) se cierran
// solos al agotarse; los ilimitados los cierra el poster a mano.
export function isSoldOut(quantity: number | null, sold: number): boolean {
  return quantity !== null && sold >= quantity;
}

// Regla de cierre: al cerrar un listing, si tuvo al menos un trato cerrado
// (Deal ACCEPTED) se da por COMPLETED; si no, CANCELLED. Distingue "se
// comerció algo" de "se retiró sin nada" para las estadísticas del servidor.
export function listingStatusOnClose(
  deals: readonly { status: DealStatus }[],
): "COMPLETED" | "CANCELLED" {
  return deals.some((d) => d.status === "ACCEPTED") ? "COMPLETED" : "CANCELLED";
}
