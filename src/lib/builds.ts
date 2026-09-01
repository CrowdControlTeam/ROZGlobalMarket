"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  build,
  buildEntry,
  buildEntryOption,
  buildEntryCard,
  item as itemTable,
  listing,
} from "@/db/schema";
import { BUILD_SLOT_VALUES, BUILD_TAG_VALUES, ItemCategory } from "@/db/enums";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getJob } from "@/lib/skill-planner";
import { itemFitsSlot } from "@/lib/item-slots";
import { loadMagicalWeaponTypes, getItemOptionGroup, validateOptions } from "@/lib/item-options";
import {
  buildSlotToEquipSlot,
  BUILD_SLOT_POSITION,
  headgearPrimary,
  parsePositions,
  type HeadgearPosition,
  MAX_BUILD_NAME_LENGTH,
  MAX_BUILD_NOTES_LENGTH,
} from "@/lib/build-constants";
import { revalidatePath } from "next/cache";

const itemCols = { id: true, name: true, iconUrl: true, slotCount: true, position: true } as const;
const ownerCols = { id: true, username: true } as const;

// TODAS las builds (de todos los usuarios) para la página de la comunidad, con
// dueño y piezas (solo el item; options/cartas no hacen falta en el listado).
export async function listBuilds() {
  await requireSession();
  return db.query.build.findMany({
    orderBy: desc(build.updatedAt),
    with: {
      owner: { columns: ownerCols },
      entries: { with: { item: { columns: itemCols } } },
    },
  });
}

// TODAS las builds con el detalle completo (item + options + cartas), para el
// navegador de builds: el panel derecho muestra cualquier build seleccionada sin
// otra ida al servidor. Misma forma de pieza que getBuild.
export async function listBuildsDetailed() {
  await requireSession();
  return db.query.build.findMany({
    orderBy: desc(build.updatedAt),
    with: {
      owner: { columns: ownerCols },
      entries: {
        with: {
          item: { columns: itemCols },
          options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
          cards: { with: { card: { columns: itemCols } }, orderBy: (c) => asc(c.slotIndex) },
        },
      },
    },
  });
}

// Una build concreta para el DETALLE — visible para cualquiera (logueado). Las
// piezas traen item + options (con su def) + cartas (con el item de la carta).
export async function getBuild(id: string) {
  await requireSession();
  return (
    (await db.query.build.findFirst({
      where: eq(build.id, id),
      with: {
        owner: { columns: ownerCols },
        entries: {
          with: {
            item: { columns: itemCols },
            options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
            cards: { with: { card: { columns: itemCols } }, orderBy: (c) => asc(c.slotIndex) },
          },
        },
      },
    })) ?? null
  );
}

// Una build concreta para EDITAR — solo del propietario (null si no lo es). El
// item trae además category/slot/weaponType para que el editor pueda recomputar
// el grupo de options (getItemOptionGroup) al precargar.
export async function getMyBuild(id: string) {
  const session = await requireSession();
  const row = await db.query.build.findFirst({
    where: eq(build.id, id),
    with: {
      entries: {
        with: {
          item: {
            columns: { id: true, name: true, iconUrl: true, slotCount: true, category: true, slot: true, weaponType: true, position: true },
          },
          options: { with: { def: true }, orderBy: (o) => asc(o.slotIndex) },
          cards: { with: { card: { columns: itemCols } }, orderBy: (c) => asc(c.slotIndex) },
        },
      },
    },
  });
  if (!row) return null;
  if (row.ownerId !== session.user.discordId) return null;
  return row;
}

// Disponibilidad en el mercado de los items de una build: nº de publicaciones de
// VENTA activas (no caducadas) por itemId. Para los badges "en venta" del
// detalle. Mismo criterio de "activo" que el grid del mercado.
export async function buildMarketAvailability(itemIds: string[]): Promise<Map<string, number>> {
  await requireSession();
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ itemId: listing.itemId, n: count() })
    .from(listing)
    .where(
      and(
        inArray(listing.itemId, ids),
        eq(listing.status, "ACTIVE"),
        eq(listing.type, "SALE"),
        or(isNull(listing.expiresAt), gt(listing.expiresAt, sql`now()`)),
      ),
    )
    .groupBy(listing.itemId);
  return new Map(rows.map((r) => [r.itemId, r.n]));
}

// Cuántas builds tiene el usuario actual (para el tope de "Crear").
export async function myBuildCount() {
  const session = await requireSession();
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(build)
    .where(eq(build.ownerId, session.user.discordId));
  return n;
}

// Entrada del editor: una pieza por slot con item + refino + options aleatorias
// + cartas (una por ranura, hasta Item.slotCount).
const entrySchema = z.object({
  slot: z.enum(BUILD_SLOT_VALUES),
  itemId: z.string().min(1),
  refineLevel: z.coerce.number().int().nonnegative(),
  options: z
    .array(z.object({ slotIndex: z.coerce.number().int(), defId: z.string().min(1), value: z.coerce.number().int() }))
    .optional()
    .default([]),
  cards: z
    .array(z.object({ slotIndex: z.coerce.number().int().nonnegative(), cardItemId: z.string().min(1) }))
    .optional()
    .default([]),
});

const buildInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_BUILD_NAME_LENGTH),
  jobId: z.coerce.number().int(),
  tags: z.array(z.enum(BUILD_TAG_VALUES)),
  notes: z.string().max(MAX_BUILD_NOTES_LENGTH).nullish(),
  entries: z.array(entrySchema),
});

export type BuildInput = z.infer<typeof buildInputSchema>;
type ParsedEntry = z.infer<typeof entrySchema>;

// Valida el payload común a crear/editar. Lanza con el mensaje i18n al primer
// fallo. Devuelve los datos saneados (una entry por slot; item que encaja en el
// slot; refino, options y cartas validados contra el item real).
async function parseBuildInput(input: unknown, t: Awaited<ReturnType<typeof getTranslations>>) {
  const parsed = buildInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(t("invalidData"));
  const data = parsed.data;

  if (!getJob(data.jobId)) throw new Error(t("buildInvalidJob"));

  const tags = Array.from(new Set(data.tags));
  if (tags.length === 0) throw new Error(t("buildNeedTag"));

  // Una entrada por slot como mucho (la última gana).
  const bySlot = new Map<string, ParsedEntry>();
  for (const e of data.entries) bySlot.set(e.slot, e);
  const entries = [...bySlot.values()];

  if (entries.length > 0) {
    const [maxRefine, magicalTypes] = await Promise.all([loadMaxRefineLevel(), loadMagicalWeaponTypes()]);

    // Items de las piezas (para slot/group/slotCount) y de las cartas (categoría).
    const itemIds = [...new Set(entries.map((e) => e.itemId))];
    const cardIds = [...new Set(entries.flatMap((e) => e.cards.map((c) => c.cardItemId)))];
    const allIds = [...new Set([...itemIds, ...cardIds])];
    const rows = await db
      .select({
        id: itemTable.id,
        category: itemTable.category,
        slot: itemTable.slot,
        weaponType: itemTable.weaponType,
        slotCount: itemTable.slotCount,
        position: itemTable.position,
      })
      .from(itemTable)
      .where(inArray(itemTable.id, allIds));
    const byId = new Map(rows.map((r) => [r.id, r]));

    for (const e of entries) {
      const it = byId.get(e.itemId);
      if (!it) throw new Error(t("itemNotFound"));
      if (!itemFitsSlot(it, buildSlotToEquipSlot(e.slot))) throw new Error(t("buildItemSlotMismatch"));
      // Tocados: se guardan en su slot principal (la posición más alta que
      // ocupan). El solapamiento entre tocados se comprueba aparte, más abajo.
      if (BUILD_SLOT_POSITION[e.slot] && headgearPrimary(it.position) !== BUILD_SLOT_POSITION[e.slot]) {
        throw new Error(t("buildItemSlotMismatch"));
      }
      if (e.refineLevel > maxRefine) throw new Error(t("refineTooHigh", { max: maxRefine }));

      // Options: mismo validador que el mercado (grupo/slot/rango del def).
      const group = getItemOptionGroup(it, magicalTypes);
      await validateOptions(e.options, group);

      // Cartas: como mucho Item.slotCount, ranuras únicas dentro de rango, y cada
      // cardItemId debe ser un item de categoría CARD.
      if (e.cards.length > it.slotCount) throw new Error(t("buildTooManyCards"));
      const seen = new Set<number>();
      for (const c of e.cards) {
        if (c.slotIndex < 0 || c.slotIndex >= it.slotCount || seen.has(c.slotIndex)) {
          throw new Error(t("invalidData"));
        }
        seen.add(c.slotIndex);
        const card = byId.get(c.cardItemId);
        if (!card || card.category !== ItemCategory.CARD) throw new Error(t("itemNotFound"));
      }
    }

    // Ningún tocado puede solaparse con otro en una posición (Upper/Middle/Lower).
    const usedPositions = new Set<HeadgearPosition>();
    for (const e of entries) {
      const it = byId.get(e.itemId)!;
      for (const p of parsePositions(it.position)) {
        if (usedPositions.has(p)) throw new Error(t("buildItemSlotMismatch"));
        usedPositions.add(p);
      }
    }
  }

  const notes = data.notes?.trim() || null;
  return { name: data.name, jobId: data.jobId, tags, notes, entries };
}

// Inserta las piezas de una build (una a una para enlazar options/cartas por id).
async function insertEntries(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  buildId: string,
  entries: ParsedEntry[],
) {
  for (const e of entries) {
    const [row] = await tx
      .insert(buildEntry)
      .values({ buildId, slot: e.slot, itemId: e.itemId, refineLevel: e.refineLevel })
      .returning();
    if (e.options.length > 0) {
      await tx.insert(buildEntryOption).values(
        e.options.map((o) => ({ entryId: row.id, slotIndex: o.slotIndex, defId: o.defId, value: o.value })),
      );
    }
    if (e.cards.length > 0) {
      await tx.insert(buildEntryCard).values(
        e.cards.map((c) => ({ entryId: row.id, slotIndex: c.slotIndex, cardItemId: c.cardItemId })),
      );
    }
  }
}

export async function createBuild(input: unknown) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const me = session.user.discordId;

  const { maxBuildsPerUser } = await loadMarketConfig();
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(build).where(eq(build.ownerId, me));
  if (n >= maxBuildsPerUser) throw new Error(t("buildLimitReached", { max: maxBuildsPerUser }));

  const data = await parseBuildInput(input, t);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(build)
      .values({ ownerId: me, name: data.name, jobId: data.jobId, tags: data.tags, notes: data.notes })
      .returning();
    await insertEntries(tx, row.id, data.entries);
    return row;
  });

  revalidatePath("/builds");
  return { id: created.id };
}

export async function updateBuild(id: string, input: unknown) {
  const session = await requireSession();
  const t = await getTranslations("errors");

  const [existing] = await db.select({ ownerId: build.ownerId }).from(build).where(eq(build.id, id)).limit(1);
  if (!existing) throw new Error(t("buildNotFound"));
  if (existing.ownerId !== session.user.discordId) throw new Error(t("notYourBuild"));

  const data = await parseBuildInput(input, t);

  await db.transaction(async (tx) => {
    await tx
      .update(build)
      .set({ name: data.name, jobId: data.jobId, tags: data.tags, notes: data.notes })
      .where(eq(build.id, id));
    // Piezas: se borran y se recrean (más simple que un diff; ≤10 piezas). Las
    // options/cartas caen en cascada al borrar las entries.
    await tx.delete(buildEntry).where(eq(buildEntry.buildId, id));
    await insertEntries(tx, id, data.entries);
  });

  revalidatePath("/builds");
  revalidatePath(`/builds/${id}`);
  return { id };
}

export async function deleteBuild(id: string) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const [existing] = await db.select({ ownerId: build.ownerId }).from(build).where(eq(build.id, id)).limit(1);
  if (!existing) throw new Error(t("buildNotFound"));
  if (existing.ownerId !== session.user.discordId) throw new Error(t("notYourBuild"));
  await db.delete(build).where(and(eq(build.id, id), eq(build.ownerId, session.user.discordId)));
  revalidatePath("/builds");
  return { ok: true };
}
