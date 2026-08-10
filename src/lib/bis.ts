import { EquipSlot, ItemOptionGroup } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig } from "@/lib/market-config";

// ¿Puede el usuario actual crear/editar BiS? Requiere sesión + tener el rol
// `bisEditorRoleId` configurado en /admin. Los administradores NO están
// exentos: editar BiS es un permiso aparte, hay que tener ese rol en concreto.
// Sin rol configurado (null) → nadie edita, la página es de solo lectura.
export async function canEditBis(): Promise<boolean> {
  const { bisEditorRoleId } = await loadMarketConfig();
  if (!bisEditorRoleId) return false;

  const session = await auth();
  const discordId = session?.user?.discordId;
  if (!discordId) return false;

  // Los roles del guild viven en el User (los guarda/actualiza el login, ver
  // src/auth.ts); la sesión no los lleva, así que se leen de BD.
  const user = await prisma.user.findUnique({
    where: { id: discordId },
    select: { guildRoles: true },
  });
  return user?.guildRoles.includes(bisEditorRoleId) ?? false;
}

// Grupo de random options fijado SOLO por el slot de equipo, para BiS
// "genéricos" (cualquier pieza con estas options) donde no hay un item
// concreto del que deducir el grupo como en el mercado (ver getItemOptionGroup).
// Solo armadura/manto/calzado tienen un grupo determinado por el slot;
// cascos/escudo/accesorio no llevan options (→ null) y el arma depende del
// weaponType (físico/mágico), que se resuelve a partir del arma elegida en la
// fase de edición, no aquí.
export function optionGroupForSlot(slot: EquipSlot): ItemOptionGroup | null {
  switch (slot) {
    case EquipSlot.ARMOR:
      return ItemOptionGroup.ARMOR;
    case EquipSlot.GARMENT:
      return ItemOptionGroup.GARMENT;
    case EquipSlot.FOOTGEAR:
      return ItemOptionGroup.FOOTGEAR;
    default:
      return null;
  }
}
