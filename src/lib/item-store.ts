import type { ItemCategory, EquipSlot, WeaponType } from "@/db/enums";
import catalog from "@/data/item-catalog.json";

// Catálogo COMPLETO de items en memoria (el registro completo de cada item, todos
// los campos) empaquetado con la app y generado en el import (ver
// src/db/seed/items.ts). Los items son datos estáticos de referencia: se importan
// y nunca se mutan en runtime, así que su lectura/validación no necesita pegar a
// Postgres. Reemplaza a las lecturas/JOINs de la tabla `Item` (ver fases del
// refactor). Es server-side: el JSON no se expone al cliente.
export type FullItem = {
  id: string;
  name: string;
  unidentifiedName: string | null;
  description: string[];
  category: ItemCategory;
  categorySource: string | null;
  slot: EquipSlot | null;
  weaponType: WeaponType | null;
  subType: string | null;
  itemType: string | null;
  slotCount: number;
  cardSlot: string | null;
  position: string | null;
  iconUrl: string;
  tradeable: boolean;
  restrictions: Record<string, boolean> | null;
  costume: boolean;
  attack: number | null;
  defense: number | null;
  weight: number | null;
  weaponLevel: number | null;
  armorLevel: number | null;
  requiredLevel: number | null;
  jobs: string | null;
  element: string | null;
  classNum: number | null;
  effectId: number | null;
  cooldown: string | null;
  petTarget: string | null;
};

const ITEMS = catalog as unknown as FullItem[];
const BY_ID: Map<string, FullItem> = new Map(ITEMS.map((it) => [it.id, it]));

// Un item por id (o undefined si no existe en el catálogo actual).
export function getItem(id: string): FullItem | undefined {
  return BY_ID.get(id);
}

// Varios items por id, como Map (para resolver en bloque los items de una lista
// de listings/entradas sin repetir búsquedas). Ignora ids desconocidos.
export function getItems(ids: Iterable<string>): Map<string, FullItem> {
  const out = new Map<string, FullItem>();
  for (const id of ids) {
    const it = BY_ID.get(id);
    if (it) out.set(id, it);
  }
  return out;
}

// ¿Existe el id en el catálogo? (para validar itemId al escribir).
export function itemExists(id: string): boolean {
  return BY_ID.has(id);
}

export function getAllItems(): FullItem[] {
  return ITEMS;
}
