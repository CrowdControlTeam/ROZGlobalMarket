// URL pública de la app, para construir enlaces absolutos (webhooks y DMs de
// Discord, iconos servidos desde /public). Antes se repetía en cada caller
// como `process.env.APP_URL ?? "http://localhost:3000"`; centralizado aquí
// para tener un único punto de lectura, normalización y aviso.
const FALLBACK_APP_URL = "http://localhost:3000";

// Devuelve la URL base sin barra final, para poder concatenar rutas
// (`${appUrl}/market/...`) y rutas de icono (`${appUrl}${item.iconUrl}`, que
// ya empiezan por "/") sin generar dobles barras. Si APP_URL no está puesta
// en producción, se avisa una vez y se cae al localhost: los enlaces de
// Discord saldrían mal, pero no debe tumbar la transacción que los origina.
let warnedMissingInProd = false;

export function getAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production" && !warnedMissingInProd) {
      warnedMissingInProd = true;
      console.warn(
        "APP_URL no está configurada en producción; usando http://localhost:3000 como fallback. Los enlaces de Discord serán incorrectos.",
      );
    }
    return FALLBACK_APP_URL;
  }
  return raw.replace(/\/+$/, "");
}
