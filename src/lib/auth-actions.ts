"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  // Destino explícito al home: un logout es una acción deliberada (borrón y
  // cuenta nueva), así que NO debe volver a la última página. El retorno por
  // callbackUrl es solo para la pérdida involuntaria de sesión (ver guard.ts).
  await signOut({ redirectTo: "/" });
}
