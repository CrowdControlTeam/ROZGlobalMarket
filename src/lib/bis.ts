import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig } from "@/lib/market-config";

// optionGroupForSlot vive en bis-constants.ts (client-safe); se reexporta aquí
// por comodidad para el código server que ya lo importaba de bis.
export { optionGroupForSlot, slotSupportsGeneric } from "@/lib/bis-constants";

// ¿Puede el usuario actual crear/editar BiS? Pueden los administradores O quien
// tenga el rol `bisEditorRoleId` configurado en /admin. Sin rol configurado
// (null) solo editan los administradores; el resto es solo lectura.
export async function canEditBis(): Promise<boolean> {
  const session = await auth();
  const discordId = session?.user?.discordId;
  if (!discordId) return false;

  // Los administradores siempre pueden; se corta antes de tocar BD.
  if (session.user.isAdmin) return true;

  const { bisEditorRoleId } = await loadMarketConfig();
  if (!bisEditorRoleId) return false;

  // Los roles del guild viven en el User (los guarda/actualiza el login, ver
  // src/auth.ts); la sesión no los lleva, así que se leen de BD.
  const user = await prisma.user.findUnique({
    where: { id: discordId },
    select: { guildRoles: true },
  });
  return user?.guildRoles.includes(bisEditorRoleId) ?? false;
}
