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

// Los errores "de usuario" se lanzan como Error(t(...)): mensajes cortos, de una
// sola línea y sin rastros técnicos (validaciones, "stock insuficiente", etc.).
// Los internos (BD, runtime) traen volcados multilínea con la consulta, SQL o
// rutas de fichero: esos NO se enseñan tal cual —quedaría feo y filtra detalles
// del backend—, se sustituyen por un mensaje genérico. La distinción es
// heurística a propósito: el error cruza la frontera server→cliente y pierde su
// clase original (deja de ser p.ej. un DatabaseError de pg/Drizzle), pero
// conserva nombre y mensaje, que es lo que se inspecciona aquí.
function looksLikeInternalError(err: Error): boolean {
  const msg = err.message;
  return (
    err.name !== "Error" || // subclases: DatabaseError, TypeError, etc.
    msg.includes("\n") ||
    msg.length > 300 ||
    msg.includes("Invalid `") || // cabecera de errores de query verbosos
    msg.includes("invocation")
  );
}

export function getErrorMessage(err: unknown, fallback = "Error inesperado"): string {
  rethrowFrameworkErrors(err);
  if (!(err instanceof Error)) return fallback;
  return looksLikeInternalError(err) ? fallback : err.message;
}
