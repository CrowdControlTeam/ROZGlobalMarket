"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import {
  EquipSlot,
  ItemOptionGroup,
  WeaponType,
  bisEntry,
  bisEntryOption,
  bisEntryToCombatRole,
  bisEntryToJob,
  bisStage,
  item as itemTable,
  itemOptionDef,
} from "@/db/schema";
import { requireSession } from "@/lib/guard";
import { requireAdmin } from "@/lib/admin-guard";
import { canEditBis, optionGroupForSlot } from "@/lib/bis";
import { itemFitsSlot } from "@/lib/bis-constants";
import { loadMarketConfig } from "@/lib/market-config";
import { loadMagicalWeaponTypes } from "@/lib/item-options";
import { MAX_OPTION_SLOTS, getItemOptionGroup } from "@/lib/item-options-constants";

const MAX_BIS_NOTE = 500;

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type ParsedOption = { slotIndex: number; defId: string; minValue: number | null };

function uniqueStrings(values: FormDataEntryValue[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => typeof v === "string" && v.trim() !== "")));
}

function parseOptionalInt(value: FormDataEntryValue | null, t: Translator): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(t("invalidData"));
  return n;
}

// Options posicionales del BiS genérico: campos planos option{1..3}DefId +
// option{1..3}MinValue. A diferencia del mercado (value exacto), aquí el valor
// es un MÍNIMO opcional (null = cualquiera). Se saltan los slots vacíos.
function parseBisOptions(formData: FormData, t: Translator): ParsedOption[] {
  const out: ParsedOption[] = [];
  for (let slotIndex = 1; slotIndex <= MAX_OPTION_SLOTS; slotIndex++) {
    const defId = formData.get(`option${slotIndex}DefId`);
    if (typeof defId !== "string" || defId === "") continue;
    const minValue = parseOptionalInt(formData.get(`option${slotIndex}MinValue`), t);
    out.push({ slotIndex, defId, minValue });
  }
  return out;
}

async function validateBisOptions(options: ParsedOption[], group: ItemOptionGroup, t: Translator): Promise<void> {
  const defs = await db
    .select()
    .from(itemOptionDef)
    .where(inArray(itemOptionDef.id, options.map((o) => o.defId)));
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const o of options) {
    const def = byId.get(o.defId);
    if (!def || def.group !== group || def.slotIndex !== o.slotIndex) {
      throw new Error(t("invalidOptionForItem"));
    }
    if (o.minValue !== null && (o.minValue < def.minValue || o.minValue > def.maxValue)) {
      throw new Error(t("optionValueRange", { label: def.label, min: def.minValue, max: def.maxValue }));
    }
  }
}

type NormalizedEntry = {
  discordId: string;
  stageId: string;
  slot: EquipSlot;
  note: string | null;
  roleIds: string[];
  jobIds: string[];
  itemId: string | null;
  weaponType: WeaponType | null;
  refineLevel: number | null;
  options: ParsedOption[];
};

// Valida el gating + el formulario y devuelve los datos normalizados,
// compartido por crear y editar. Un BiS es item CONCRETO (itemId + refine/slots)
// XOR GENÉRICO (options); en ambos casos ≥1 etiqueta (rol o job).
async function parseEntryForm(formData: FormData, t: Translator): Promise<NormalizedEntry> {
  const session = await requireSession();
  if (!(await canEditBis())) throw new Error(t("notBisEditor"));

  const schema = z.object({
    stageId: z.string().min(1, t("invalidData")),
    slot: z.nativeEnum(EquipSlot),
    note: z.string().trim().max(MAX_BIS_NOTE, t("notesTooLong", { max: MAX_BIS_NOTE })).optional(),
  });
  const parsed = schema.safeParse({
    stageId: formData.get("stageId"),
    slot: formData.get("slot"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  const { stageId, slot, note } = parsed.data;

  const [stage] = await db
    .select({ id: bisStage.id })
    .from(bisStage)
    .where(eq(bisStage.id, stageId))
    .limit(1);
  if (!stage) throw new Error(t("stageNotFound"));

  const roleIds = uniqueStrings(formData.getAll("roleIds"));
  const jobIds = uniqueStrings(formData.getAll("jobIds"));
  if (roleIds.length + jobIds.length === 0) throw new Error(t("bisNeedTag"));

  // Un BiS es: item CONCRETO, o —en arma— un TIPO DE ARMA ("cualquier Daga"), o
  // GENÉRICO por options; en todos ≥1 etiqueta. El pool de options sale del item,
  // del tipo de arma (físico/mágico) o del slot. Un item o un tipo puede además
  // llevar options concretas.
  let itemId: string | null = null;
  let weaponType: WeaponType | null = null;
  let refineLevel: number | null = null;
  let group: ItemOptionGroup | null = null;

  const rawItemId = formData.get("itemId");
  const hasItem = typeof rawItemId === "string" && rawItemId !== "";

  if (hasItem) {
    const [item] = await db
      .select({
        id: itemTable.id,
        category: itemTable.category,
        slot: itemTable.slot,
        weaponType: itemTable.weaponType,
      })
      .from(itemTable)
      .where(eq(itemTable.id, rawItemId as string))
      .limit(1);
    if (!item) throw new Error(t("itemNotFound"));
    // Integridad: el item debe encajar en el slot del BiS (mismo criterio que el
    // filtro del buscador). Defensa por si llega un itemId manipulado.
    if (!itemFitsSlot(item, slot)) throw new Error(t("bisItemSlotMismatch"));
    itemId = item.id;
    group = getItemOptionGroup(item, await loadMagicalWeaponTypes());

    const { maxRefineLevel } = await loadMarketConfig();
    refineLevel = parseOptionalInt(formData.get("refineLevel"), t);
    if (refineLevel !== null) {
      if (refineLevel < 0) throw new Error(t("positiveRefine"));
      if (refineLevel > maxRefineLevel) throw new Error(t("refineTooHigh", { max: maxRefineLevel }));
    }
    // Las ranuras salen de Item.slotCount, no se piden.
  } else if (slot === EquipSlot.WEAPON) {
    // Arma genérica: tipo de arma opcional; determina el pool físico/mágico.
    const rawWeaponType = formData.get("weaponType");
    if (typeof rawWeaponType === "string" && rawWeaponType !== "") {
      if (!(Object.values(WeaponType) as string[]).includes(rawWeaponType)) throw new Error(t("invalidData"));
      weaponType = rawWeaponType as WeaponType;
      const magicalTypes = await loadMagicalWeaponTypes();
      group = magicalTypes.has(weaponType) ? ItemOptionGroup.WEAPON_MAGICAL : ItemOptionGroup.WEAPON_PHYSICAL;
    }
  } else {
    group = optionGroupForSlot(slot);
  }

  const options = parseBisOptions(formData, t);

  // Regla: al menos uno de item, tipo de arma (solo arma) u options. Un slot de
  // equipo "cualquiera" sin nada más no aporta (todo slot necesita un item), así
  // que se exige concretar algo.
  if (!hasItem && weaponType === null && options.length === 0) {
    throw new Error(t("bisNeedItemOrOption"));
  }

  if (options.length > 0) {
    if (!group) {
      // Hay options pero no hay pool: item que no las admite, arma genérica sin
      // tipo elegido, o slot sin options.
      throw new Error(
        !hasItem && slot === EquipSlot.WEAPON ? t("bisWeaponTypeRequired") : t("bisNoOptionsForSlot"),
      );
    }
    await validateBisOptions(options, group, t);
  }

  return {
    discordId: session.user.discordId,
    stageId,
    slot,
    note: note && note.length > 0 ? note : null,
    roleIds,
    jobIds,
    itemId,
    weaponType,
    refineLevel,
    options,
  };
}

// Prisma resolvía roles/jobs (m2m implícita) y options (relación anidada) con
// `connect`/`set`/`create`; en Drizzle se insertan a mano en las tablas puente
// (_BisEntryToCombatRole/_BisEntryToJob: a=entryId, b=rol/job) y en BisEntryOption.
type BisTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function insertEntryRelations(tx: BisTx, entryId: string, d: NormalizedEntry): Promise<void> {
  if (d.roleIds.length > 0) {
    await tx.insert(bisEntryToCombatRole).values(d.roleIds.map((id) => ({ a: entryId, b: id })));
  }
  if (d.jobIds.length > 0) {
    await tx.insert(bisEntryToJob).values(d.jobIds.map((id) => ({ a: entryId, b: id })));
  }
  if (d.options.length > 0) {
    await tx.insert(bisEntryOption).values(
      d.options.map((o) => ({ entryId, slotIndex: o.slotIndex, defId: o.defId, minValue: o.minValue })),
    );
  }
}

export async function createBisEntry(formData: FormData): Promise<void> {
  const t = await getTranslations("errors");
  const d = await parseEntryForm(formData, t);

  await db.transaction(async (tx) => {
    // Se añade al final de su slot (position = máxima + 1).
    const [{ maxPos } = { maxPos: null }] = await tx
      .select({ maxPos: max(bisEntry.position) })
      .from(bisEntry)
      .where(and(eq(bisEntry.stageId, d.stageId), eq(bisEntry.slot, d.slot)));
    const [created] = await tx
      .insert(bisEntry)
      .values({
        stageId: d.stageId,
        slot: d.slot,
        itemId: d.itemId,
        weaponType: d.weaponType,
        refineLevel: d.refineLevel,
        note: d.note,
        position: (maxPos ?? -1) + 1,
        createdById: d.discordId,
      })
      .returning({ id: bisEntry.id });
    await insertEntryRelations(tx, created.id, d);
  });

  revalidatePath("/bis");
}

export async function updateBisEntry(entryId: string, formData: FormData): Promise<void> {
  const t = await getTranslations("errors");
  const d = await parseEntryForm(formData, t);

  const [existing] = await db
    .select({ id: bisEntry.id })
    .from(bisEntry)
    .where(eq(bisEntry.id, entryId))
    .limit(1);
  if (!existing) throw new Error(t("bisEntryNotFound"));

  // stageId/slot/position son inmutables por entrada (el form los abre desde su
  // slot y etapa); editar solo cambia contenido y etiquetas. Options y etiquetas =
  // borrar-y-recrear, como en el mercado (más simple que diff).
  await db.transaction(async (tx) => {
    await tx.delete(bisEntryOption).where(eq(bisEntryOption.entryId, entryId));
    await tx.delete(bisEntryToCombatRole).where(eq(bisEntryToCombatRole.a, entryId));
    await tx.delete(bisEntryToJob).where(eq(bisEntryToJob.a, entryId));
    await tx
      .update(bisEntry)
      .set({
        itemId: d.itemId,
        weaponType: d.weaponType,
        refineLevel: d.refineLevel,
        note: d.note,
      })
      .where(eq(bisEntry.id, entryId));
    await insertEntryRelations(tx, entryId, d);
  });

  revalidatePath("/bis");
}

export async function deleteBisEntry(entryId: string): Promise<void> {
  const t = await getTranslations("errors");
  await requireSession();
  if (!(await canEditBis())) throw new Error(t("notBisEditor"));

  const deleted = await db.delete(bisEntry).where(eq(bisEntry.id, entryId)).returning({ id: bisEntry.id });
  if (deleted.length === 0) throw new Error(t("bisEntryNotFound"));

  revalidatePath("/bis");
}

// Reordena los BiS de un slot (drag & drop): `orderedIds` es el nuevo orden
// completo de las entradas de ese stage+slot; se les asigna position = índice.
// Solo se tocan las que de verdad pertenecen a ese stage+slot (defensa).
export async function reorderBisEntries(
  stageId: string,
  slot: EquipSlot,
  orderedIds: string[],
): Promise<void> {
  const t = await getTranslations("errors");
  await requireSession();
  if (!(await canEditBis())) throw new Error(t("notBisEditor"));

  const existing = await db
    .select({ id: bisEntry.id })
    .from(bisEntry)
    .where(and(eq(bisEntry.stageId, stageId), eq(bisEntry.slot, slot)));
  const valid = new Set(existing.map((e) => e.id));
  const ordered = orderedIds.filter((id) => valid.has(id));

  await db.transaction(async (tx) => {
    for (const [index, id] of ordered.entries()) {
      await tx.update(bisEntry).set({ position: index }).where(eq(bisEntry.id, id));
    }
  });

  revalidatePath("/bis");
}

// ── Gestión de ETAPAS (admin) ──────────────────────────────────────────────
// Las etapas (BisStage) son la dimensión temporal de la página de BiS. Antes
// solo se sembraban por script; esto las hace administrables desde /admin/features.
// El `key` es un identificador interno único (no se muestra): se autogenera del
// label. El `order` fija el orden en la página de BiS (mayor order = primera).

const MAX_STAGE_LABEL = 60;

// Slug ASCII a partir del label, para el `key` interno (único).
function slugifyStage(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "etapa";
}

// Primera clave libre a partir de una base (base, base-2, base-3…).
async function freeStageKey(base: string): Promise<string> {
  let key = base;
  let n = 2;
  while (
    (await db.select({ id: bisStage.id }).from(bisStage).where(eq(bisStage.key, key)).limit(1)).length > 0
  ) {
    key = `${base}-${n++}`;
  }
  return key;
}

function revalidateStages() {
  revalidatePath("/bis");
  revalidatePath("/admin/features");
}

export async function createBisStage(label: string): Promise<void> {
  const t = await getTranslations("errors");
  await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_STAGE_LABEL) throw new Error(t("invalidData"));
  const key = await freeStageKey(slugifyStage(trimmed));
  const [{ maxOrder } = { maxOrder: null }] = await db
    .select({ maxOrder: max(bisStage.order) })
    .from(bisStage);
  await db.insert(bisStage).values({ key, label: trimmed, order: (maxOrder ?? 0) + 1 });
  revalidateStages();
}

export async function renameBisStage(id: string, label: string): Promise<void> {
  const t = await getTranslations("errors");
  await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_STAGE_LABEL) throw new Error(t("invalidData"));
  const [exists] = await db.select({ id: bisStage.id }).from(bisStage).where(eq(bisStage.id, id)).limit(1);
  if (!exists) throw new Error(t("stageNotFound"));
  await db.update(bisStage).set({ label: trimmed }).where(eq(bisStage.id, id));
  revalidateStages();
}

// Borra una etapa. CASCADE: se borran también todos sus BiS (ver schema) — la
// confirmación vive en la UI.
export async function deleteBisStage(id: string): Promise<void> {
  const t = await getTranslations("errors");
  await requireAdmin();
  const [exists] = await db.select({ id: bisStage.id }).from(bisStage).where(eq(bisStage.id, id)).limit(1);
  if (!exists) throw new Error(t("stageNotFound"));
  await db.delete(bisStage).where(eq(bisStage.id, id));
  revalidateStages();
}

// Reordena las etapas. `orderedIds` va de ARRIBA a ABAJO tal como se ven en el
// admin = de mayor a menor `order` (la página de BiS muestra la de mayor order
// primero). Solo se tocan ids válidos (defensa).
export async function reorderBisStages(orderedIds: string[]): Promise<void> {
  await requireAdmin();
  const existing = await db.select({ id: bisStage.id }).from(bisStage);
  const valid = new Set(existing.map((s) => s.id));
  const ordered = orderedIds.filter((id) => valid.has(id));
  const n = ordered.length;
  await db.transaction(async (tx) => {
    for (const [i, id] of ordered.entries()) {
      await tx.update(bisStage).set({ order: n - i }).where(eq(bisStage.id, id));
    }
  });
  revalidateStages();
}
