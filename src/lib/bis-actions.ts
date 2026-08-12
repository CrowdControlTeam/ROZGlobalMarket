"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { EquipSlot, ItemOptionGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guard";
import { canEditBis, optionGroupForSlot } from "@/lib/bis";
import { itemFitsSlot } from "@/lib/bis-constants";
import { loadMarketConfig } from "@/lib/market-config";
import { loadMagicalWeaponTypes } from "@/lib/item-options";
import { MAX_OPTION_SLOTS, getItemOptionGroup } from "@/lib/item-options-constants";

const MAX_BIS_NOTE = 500;

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type WeaponClass = "PHYSICAL" | "MAGICAL";
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

// Grupo de options del BiS genérico: por slot (armadura/manto/calzado) o, en
// arma, según el toggle físico/mágico del formulario.
function resolveOptionGroup(slot: EquipSlot, weaponClass: WeaponClass | null): ItemOptionGroup | null {
  if (slot === EquipSlot.WEAPON) {
    if (weaponClass === "PHYSICAL") return ItemOptionGroup.WEAPON_PHYSICAL;
    if (weaponClass === "MAGICAL") return ItemOptionGroup.WEAPON_MAGICAL;
    return null;
  }
  return optionGroupForSlot(slot);
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
  const defs = await prisma.itemOptionDef.findMany({
    where: { id: { in: options.map((o) => o.defId) } },
  });
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

  const stage = await prisma.bisStage.findUnique({ where: { id: stageId }, select: { id: true } });
  if (!stage) throw new Error(t("stageNotFound"));

  const roleIds = uniqueStrings(formData.getAll("roleIds"));
  const jobIds = uniqueStrings(formData.getAll("jobIds"));
  if (roleIds.length + jobIds.length === 0) throw new Error(t("bisNeedTag"));

  // Item (opcional) y options (opcional), pero al menos uno de los dos. Un item
  // concreto puede además llevar options concretas (de su propio pool).
  let itemId: string | null = null;
  let refineLevel: number | null = null;
  // Grupo del pool de options: del propio item si hay uno; si no, por slot (o
  // físico/mágico en arma).
  let group: ItemOptionGroup | null = null;

  const rawItemId = formData.get("itemId");
  const hasItem = typeof rawItemId === "string" && rawItemId !== "";

  if (hasItem) {
    const item = await prisma.item.findUnique({
      where: { id: rawItemId as string },
      select: { id: true, category: true, slot: true, weaponType: true },
    });
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
  } else {
    const rawWeaponClass = formData.get("weaponClass");
    const weaponClass: WeaponClass | null =
      rawWeaponClass === "PHYSICAL" || rawWeaponClass === "MAGICAL" ? rawWeaponClass : null;
    group = resolveOptionGroup(slot, weaponClass);
  }

  const options = parseBisOptions(formData, t);

  // Regla: al menos uno de item u options.
  if (!hasItem && options.length === 0) throw new Error(t("bisNeedItemOrOption"));

  if (options.length > 0) {
    if (!group) {
      // Hay options pero no hay pool: item que no admite options, o arma
      // genérica sin elegir físico/mágico, o slot sin options.
      throw new Error(
        !hasItem && slot === EquipSlot.WEAPON ? t("bisWeaponClassRequired") : t("bisNoOptionsForSlot"),
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
    refineLevel,
    options,
  };
}

function optionCreateData(options: ParsedOption[]) {
  return options.length > 0
    ? { create: options.map((o) => ({ slotIndex: o.slotIndex, defId: o.defId, minValue: o.minValue })) }
    : undefined;
}

export async function createBisEntry(formData: FormData): Promise<void> {
  const t = await getTranslations("errors");
  const d = await parseEntryForm(formData, t);

  await prisma.$transaction(async (tx) => {
    // Se añade al final de su slot (position = máxima + 1).
    const max = await tx.bisEntry.aggregate({
      where: { stageId: d.stageId, slot: d.slot },
      _max: { position: true },
    });
    await tx.bisEntry.create({
      data: {
        stageId: d.stageId,
        slot: d.slot,
        itemId: d.itemId,
        refineLevel: d.refineLevel,
        note: d.note,
        position: (max._max.position ?? -1) + 1,
        createdById: d.discordId,
        roles: { connect: d.roleIds.map((id) => ({ id })) },
        jobs: { connect: d.jobIds.map((id) => ({ id })) },
        options: optionCreateData(d.options),
      },
    });
  });

  revalidatePath("/bis");
}

export async function updateBisEntry(entryId: string, formData: FormData): Promise<void> {
  const t = await getTranslations("errors");
  const d = await parseEntryForm(formData, t);

  const existing = await prisma.bisEntry.findUnique({ where: { id: entryId }, select: { id: true } });
  if (!existing) throw new Error(t("bisEntryNotFound"));

  // stageId/slot/position son inmutables por entrada (el form los abre desde su
  // slot y etapa); editar solo cambia contenido y etiquetas. Options =
  // borrar-y-recrear, como en el mercado (más simple que diff).
  await prisma.$transaction(async (tx) => {
    await tx.bisEntryOption.deleteMany({ where: { entryId } });
    await tx.bisEntry.update({
      where: { id: entryId },
      data: {
        itemId: d.itemId,
        refineLevel: d.refineLevel,
        note: d.note,
        roles: { set: d.roleIds.map((id) => ({ id })) },
        jobs: { set: d.jobIds.map((id) => ({ id })) },
        options: optionCreateData(d.options),
      },
    });
  });

  revalidatePath("/bis");
}

export async function deleteBisEntry(entryId: string): Promise<void> {
  const t = await getTranslations("errors");
  await requireSession();
  if (!(await canEditBis())) throw new Error(t("notBisEditor"));

  try {
    await prisma.bisEntry.delete({ where: { id: entryId } });
  } catch {
    throw new Error(t("bisEntryNotFound"));
  }

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

  const existing = await prisma.bisEntry.findMany({
    where: { stageId, slot },
    select: { id: true },
  });
  const valid = new Set(existing.map((e) => e.id));
  const ordered = orderedIds.filter((id) => valid.has(id));

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.bisEntry.update({ where: { id }, data: { position: index } }),
    ),
  );

  revalidatePath("/bis");
}
