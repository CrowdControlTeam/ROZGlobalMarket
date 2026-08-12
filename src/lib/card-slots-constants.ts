// Pura y sin dependencias de servidor, usable también desde componentes cliente.
// El nº de ranuras de carta ahora es un dato del propio item (Item.slotCount,
// extraído del cliente del juego), así que ya no se calcula por heurística ni lo
// indica quien publica. Aquí solo queda el formateo del nombre.

// Prefijo de refine (con espacio) + sufijo de slots (pegado, sin espacio),
// combinables entre sí: "+7 Silk Robe[1]". Ninguno se muestra si es 0.
export function formatItemDisplayName(name: string, refineLevel: number, cardSlots: number): string {
  const prefix = refineLevel > 0 ? `+${refineLevel} ` : "";
  const suffix = cardSlots > 0 ? `[${cardSlots}]` : "";
  return `${prefix}${name}${suffix}`;
}
