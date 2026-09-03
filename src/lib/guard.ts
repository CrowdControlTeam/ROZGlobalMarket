import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { loadMarketConfig } from "@/lib/market-config";

// Guard base de páginas/acciones protegidas. La pertenencia al guild ya se
// verificó al hacer login (ver src/auth.ts); aquí solo: sin sesión → al login,
// recordando la página actual (callbackUrl) para volver tras reloguearse. El
// pathname lo expone el middleware en x-pathname (App Router no lo da en el
// servidor). El mantenimiento NO se comprueba aquí (ver requireMarketSession):
// así /builds y /db siguen abiertos aunque el mercado esté en mantenimiento.
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    const pathname = (await headers()).get("x-pathname");
    // Solo rutas del mismo origen (relativas) para no abrir un open-redirect.
    const callback =
      pathname && pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : null;
    redirect(callback && callback !== "/" ? `/?callbackUrl=${encodeURIComponent(callback)}` : "/");
  }
  return session;
}

// Guard de la sección MERCADO: como requireSession pero además, en mantenimiento,
// manda a /maintenance a quien no sea admin. Es el punto único de intercepción
// para el mercado; los `throw` de las acciones de escritura siguen como red de
// seguridad. /builds y /db (solo lectura, ajenos al mercado) NO se bloquean. (No va
// en el middleware porque el flag está en la BD y Prisma no corre bien en el
// runtime de middleware de Workers.)
export async function requireMarketSession() {
  const session = await requireSession();
  if (!session.user.isAdmin) {
    const { maintenanceModeEnabled } = await loadMarketConfig();
    if (maintenanceModeEnabled) redirect("/maintenance");
  }
  return session;
}
