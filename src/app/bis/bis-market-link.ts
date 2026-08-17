import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { NEW_TAB_PARAM } from "@/app/market/marketFilterKeys";
import type { BisEntryView } from "./BisBoard";

// Construye el query string del mercado a partir de una entrada de BiS:
//   - slot de equipo (siempre)
//   - tipo de arma, si es un BiS de arma con tipo (genérico o del item concreto)
//   - nombre del item, si se eligió uno concreto (el mercado filtra por nombre;
//     no hay filtro por id)
//   - cada random option con su mínimo (option{n}Stat / option{n}Min)
// NO copia el refino a propósito (el del BiS es un objetivo, no un buen filtro) y
// deja el tipo en ALL (sin `type`), para que el usuario elija compra/venta/etc.
// Enums como literales para no arrastrar @prisma/client al bundle de cliente.
export function bisEntryMarketQuery(entry: BisEntryView): string {
  const p = new URLSearchParams();
  p.set("slot", entry.slot);

  const weaponType = entry.weaponType ?? entry.item?.weaponType ?? null;
  if (entry.slot === "WEAPON" && weaponType) p.set("weaponType", weaponType);

  if (entry.item) p.set("q", entry.item.name);

  for (const o of entry.options) {
    if (o.slotIndex < 1 || o.slotIndex > MAX_OPTION_SLOTS) continue;
    p.set(`option${o.slotIndex}Stat`, o.statCode);
    if (o.minValue !== null) p.set(`option${o.slotIndex}Min`, String(o.minValue));
  }

  p.set(NEW_TAB_PARAM, "1");
  return p.toString();
}
