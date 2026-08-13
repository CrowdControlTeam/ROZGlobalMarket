"use server";

import { getDbItemDetail } from "@/lib/db-items";

// Acción para el modal de detalle: el grid es server-rendered, pero el tooltip
// completo (descripción larga + stats) se pide al hacer click para no inflar el
// payload con las descripciones de los 48 items de la página. requireSession va
// dentro de getDbItemDetail.
export async function fetchDbItemDetail(id: string) {
  return getDbItemDetail(id);
}
