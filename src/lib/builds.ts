"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { build, buildEntry, item as itemTable } from "@/db/schema";
import { BUILD_SLOT_VALUES, BUILD_TAG_VALUES } from "@/db/enums";
import { requireSession } from "@/lib/guard";
import { loadMarketConfig } from "@/lib/market-config";
import { loadMaxRefineLevel } from "@/lib/refine";
import { getJob } from "@/lib/skill-planner";
import { itemFitsSlot } from "@/lib/item-slots";
import { buildSlotToEquipSlot, MAX_BUILD_NAME_LENGTH, MAX_BUILD_NOTES_LENGTH } from "@/lib/build-constants";
import { revalidatePath } from "next/cache";

const itemCols = { id: true, name: true, iconUrl: true, slotCount: true } as const;

// Todas mis builds (con sus piezas) para el listado y para precargar el editor.
export async function listMyBuilds() {
  const session = await requireSession();
  return db.query.build.findMany({
    where: eq(build.ownerId, session.user.discordId),
    orderBy: desc(build.updatedAt),
    with: {
      entries: { with: { item: { columns: itemCols } } },
    },
  });
}

// Una build concreta (para el detalle/editor). Solo del propietario.
export async function getMyBuild(id: string) {
  const session = await requireSession();
  const row = await db.query.build.findFirst({
    where: eq(build.id, id),
    with: { entries: { with: { item: { columns: itemCols } } } },
  });
  if (!row) return null;
  if (row.ownerId !== session.user.discordId) return null;
  return row;
}

// Entrada del editor: una pieza por slot (item + refino). Options y cartas se
// añaden en una fase siguiente.
const entrySchema = z.object({
  slot: z.enum(BUILD_SLOT_VALUES),
  itemId: z.string().min(1),
  refineLevel: z.coerce.number().int().nonnegative(),
});

const buildInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_BUILD_NAME_LENGTH),
  jobId: z.coerce.number().int(),
  tags: z.array(z.enum(BUILD_TAG_VALUES)),
  notes: z.string().max(MAX_BUILD_NOTES_LENGTH).nullish(),
  entries: z.array(entrySchema),
});

export type BuildInput = z.infer<typeof buildInputSchema>;

// Valida el payload común a crear/editar. Lanza con el mensaje i18n al primer
// fallo. Devuelve los datos ya saneados (tags deduplicadas, una entry por slot,
// items validados contra su slot y el refino).
async function parseBuildInput(input: unknown, t: Awaited<ReturnType<typeof getTranslations>>) {
  const parsed = buildInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(t("invalidData"));
  const data = parsed.data;

  if (!getJob(data.jobId)) throw new Error(t("buildInvalidJob"));

  const tags = Array.from(new Set(data.tags));
  if (tags.length === 0) throw new Error(t("buildNeedTag"));

  // Una entrada por slot como mucho (la última gana); solo las que tienen item.
  const bySlot = new Map<string, (typeof data.entries)[number]>();
  for (const e of data.entries) bySlot.set(e.slot, e);
  const entries = [...bySlot.values()];

  if (entries.length > 0) {
    const maxRefine = await loadMaxRefineLevel();
    const ids = [...new Set(entries.map((e) => e.itemId))];
    const items = await db
      .select({ id: itemTable.id, category: itemTable.category, slot: itemTable.slot })
      .from(itemTable)
      .where(inArray(itemTable.id, ids));
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const e of entries) {
      const it = itemById.get(e.itemId);
      if (!it) throw new Error(t("itemNotFound"));
      if (!itemFitsSlot(it, buildSlotToEquipSlot(e.slot))) throw new Error(t("buildItemSlotMismatch"));
      if (e.refineLevel > maxRefine) throw new Error(t("refineTooHigh", { max: maxRefine }));
    }
  }

  const notes = data.notes?.trim() || null;
  return { name: data.name, jobId: data.jobId, tags, notes, entries };
}

export async function createBuild(input: unknown) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const me = session.user.discordId;

  const { maxBuildsPerUser } = await loadMarketConfig();
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(build)
    .where(eq(build.ownerId, me));
  if (n >= maxBuildsPerUser) throw new Error(t("buildLimitReached", { max: maxBuildsPerUser }));

  const data = await parseBuildInput(input, t);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(build)
      .values({ ownerId: me, name: data.name, jobId: data.jobId, tags: data.tags, notes: data.notes })
      .returning();
    if (data.entries.length > 0) {
      await tx.insert(buildEntry).values(
        data.entries.map((e) => ({ buildId: row.id, slot: e.slot, itemId: e.itemId, refineLevel: e.refineLevel })),
      );
    }
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
    // Piezas: se borran y se recrean (más simple que un diff; el volumen es ≤10).
    await tx.delete(buildEntry).where(eq(buildEntry.buildId, id));
    if (data.entries.length > 0) {
      await tx.insert(buildEntry).values(
        data.entries.map((e) => ({ buildId: id, slot: e.slot, itemId: e.itemId, refineLevel: e.refineLevel })),
      );
    }
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
