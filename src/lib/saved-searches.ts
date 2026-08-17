"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { serializeFilters, parseFilters } from "@/app/market/marketFilterKeys";

// Búsquedas de mercado guardadas por usuario (las pestañas de "Mis búsquedas"
// persistidas). Los filtros viajan como query string (misma semántica que la
// URL); aquí siempre se re-sanean con parseFilters+serializeFilters para no
// guardar claves basura y que el string sea comparable con el de la pestaña.

// Tope por usuario: suficiente para organizarse sin permitir abusos.
const MAX_SAVED_SEARCHES = 30;

// Lo que necesita el cliente de una búsqueda guardada (sin fechas ni userId).
export type SavedSearchDTO = { id: string; name: string; filters: string };

const nameSchema = z.string().trim().min(1).max(60);

function toDTO(s: { id: string; name: string; filters: string }): SavedSearchDTO {
  return { id: s.id, name: s.name, filters: s.filters };
}

// Normaliza un query string de filtros a su forma canónica (claves conocidas,
// orden estable), para guardar y comparar de forma consistente.
function cleanFilters(raw: string): string {
  return serializeFilters(parseFilters(raw));
}

export async function listSavedSearches(): Promise<SavedSearchDTO[]> {
  const session = await requireSession();
  const rows = await prisma.savedSearch.findMany({
    where: { userId: session.user.discordId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDTO);
}

export async function createSavedSearch(name: string, filters: string): Promise<SavedSearchDTO> {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const userId = session.user.discordId;

  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) throw new Error(t("invalidData"));

  const count = await prisma.savedSearch.count({ where: { userId } });
  if (count >= MAX_SAVED_SEARCHES) throw new Error(t("savedSearchLimit", { max: MAX_SAVED_SEARCHES }));

  const max = await prisma.savedSearch.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const created = await prisma.savedSearch.create({
    data: {
      userId,
      name: parsedName.data,
      filters: cleanFilters(filters),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  return toDTO(created);
}

// Comprueba que la búsqueda existe y es del usuario; devuelve su id validado.
async function requireOwned(id: string): Promise<string> {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const row = await prisma.savedSearch.findUnique({ where: { id }, select: { userId: true } });
  if (!row) throw new Error(t("savedSearchNotFound"));
  if (row.userId !== session.user.discordId) throw new Error(t("notYourSavedSearch"));
  return id;
}

export async function renameSavedSearch(id: string, name: string): Promise<void> {
  const t = await getTranslations("errors");
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) throw new Error(t("invalidData"));
  await requireOwned(id);
  await prisma.savedSearch.update({ where: { id }, data: { name: parsedName.data } });
}

export async function updateSavedSearch(id: string, filters: string): Promise<void> {
  await requireOwned(id);
  await prisma.savedSearch.update({ where: { id }, data: { filters: cleanFilters(filters) } });
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await requireOwned(id);
  await prisma.savedSearch.delete({ where: { id } });
}
