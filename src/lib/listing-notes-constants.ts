// Notas libres opcionales de un listing (cualquier tipo). Constante compartida
// por el formulario (cliente, atributo maxLength) y las acciones de servidor
// (createListing/sendGift) para no desincronizar el límite.
export const MAX_LISTING_NOTES_LENGTH = 500;

// Normaliza el valor de formData: recorta espacios y convierte "" en null (el
// campo es opcional). La validación de longitud se hace en las acciones, con su
// mensaje i18n.
export function parseListingNotes(raw: FormDataEntryValue | null): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed === "" ? null : trimmed;
}
