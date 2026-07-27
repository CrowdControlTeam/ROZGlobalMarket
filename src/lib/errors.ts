import { unstable_rethrow } from "next/navigation";

// redirect()/notFound() de Next se implementan lanzando una excepción
// especial (digest NEXT_REDIRECT/NEXT_NOT_FOUND) para que el framework
// intercepte la navegación — un catch genérico la atraparía igual que un
// error normal y la mostraría como texto en vez de dejar que Next navegue.
// unstable_rethrow vuelve a lanzarla tal cual si lo es (no-op para
// cualquier otro error); ver requireSession() en guard.ts, que hace
// redirect() si la sesión caducó a mitad de una interacción. Llamar
// siempre lo primero dentro de un catch, antes de cualquier otro manejo.
export function rethrowFrameworkErrors(err: unknown): void {
  unstable_rethrow(err);
}

export function getErrorMessage(err: unknown, fallback = "Error inesperado"): string {
  rethrowFrameworkErrors(err);
  return err instanceof Error ? err.message : fallback;
}
