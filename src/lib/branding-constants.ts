// Límites e utilidades para las imágenes de marca (logo de cabecera + imagen
// del hub) que un admin sube desde /admin. Se guardan como data-URI base64 en
// MarketConfig (no hay object storage). Módulo plano (sin "use server" ni "use
// client") para poder validarlas tanto en el uploader del cliente como en el
// server action.

// Tamaño máximo del ARCHIVO (antes de codificar a base64). El logo admite un
// GIF de cabecera; la imagen del hub es mayor.
export const MAX_LOGO_BYTES = 150 * 1024; // 150 KB
export const MAX_HOME_IMAGE_BYTES = 512 * 1024; // 512 KB

// data-URI de imagen: "data:image/<tipo>;base64,....".
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL.test(value);
}

// Tamaño aproximado en bytes del contenido de un data-URI base64, sin
// decodificar (base64: 4 caracteres ≈ 3 bytes). Para validar el peso en
// servidor a partir de la cadena recibida.
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
