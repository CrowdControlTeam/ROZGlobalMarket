import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guard";

// Además de tener sesión, exige el permiso "Administrator" del servidor de
// Discord (ver isGuildAdmin en src/auth.ts) — quien no lo tenga, ni ve /admin
// ni puede llamar a las server actions de configuración.
export async function requireAdmin() {
  const session = await requireSession();
  if (!session.user.isAdmin) redirect("/");
  return session;
}
