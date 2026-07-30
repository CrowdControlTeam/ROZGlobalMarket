import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";

// Guard de páginas/acciones protegidas. La pertenencia al guild ya se verificó
// al hacer login (ver src/auth.ts); aquí:
//  1. Sin sesión → al login, recordando la página actual (callbackUrl) para
//     volver a ella tras reloguearse. El pathname lo expone el middleware en
//     x-pathname (App Router no lo da en el servidor).
//  2. En mantenimiento → quien no sea admin va a /maintenance. Es el punto único
//     de intercepción para navegación; los `throw` de las acciones de escritura
//     siguen como red de seguridad. (No va en el middleware porque el flag está
//     en la BD y Prisma no corre bien en el runtime de middleware de Workers.)
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    const pathname = (await headers()).get("x-pathname");
    // Solo rutas del mismo origen (relativas) para no abrir un open-redirect.
    const callback =
      pathname && pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : null;
    redirect(callback && callback !== "/" ? `/?callbackUrl=${encodeURIComponent(callback)}` : "/");
  }
  if (!session.user.isAdmin) {
    const { maintenanceModeEnabled } = await loadMarketConfig();
    if (maintenanceModeEnabled) redirect("/maintenance");
  }
  return session;
}
