"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EquipSlot, ItemOptionGroup, WeaponType } from "@/db/enums";
import type { ItemOptionDef } from "@/db/schema";
import { ItemPicker, type ItemResult } from "@/app/market/ItemPicker";
import { getOptionChoices, getMaxRefineLevel } from "@/lib/listings";
import { createBisEntry, updateBisEntry, deleteBisEntry } from "@/lib/bis-actions";
import { optionGroupForSlot } from "@/lib/bis-constants";
import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { getErrorMessage } from "@/lib/errors";
import { slotLabel, weaponTypeLabel } from "@/lib/market-labels";
import { buttonClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import type { Tag, BisEntryView, BisEntryItem } from "./BisBoard";

type OptionInput = { defId: string; minValue: string };

const WEAPON_TYPES = Object.values(WeaponType);

function toItemResult(item: BisEntryItem): ItemResult {
  return {
    id: item.id,
    name: item.name,
    iconUrl: item.iconUrl,
    category: item.category,
    slot: item.slot,
    weaponType: item.weaponType,
    slotCount: item.cardSlots,
    optionGroup: item.optionGroup,
  };
}

// Formulario de BiS (crear/editar) en un modal centrado. El padre lo remonta con
// `key` por apertura, así el estado arranca limpio desde las props sin efectos
// de reseteo.
export function BisEntryForm({
  stageId,
  slots,
  entry,
  roles,
  jobs,
  magicalTypes,
  onClose,
}: {
  stageId: string;
  // Slots del cell: 1 (la mayoría) o varios (cabeza = upper/mid/lower).
  slots: EquipSlot[];
  entry: BisEntryView | null;
  roles: Tag[];
  jobs: Tag[];
  magicalTypes: WeaponType[];
  onClose: () => void;
}) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const router = useRouter();
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [slot, setSlot] = useState<EquipSlot>(entry?.slot ?? slots[0]);

  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(
    entry?.item ? toItemResult(entry.item) : null,
  );
  const [refine, setRefine] = useState(entry?.item?.refineLevel ? String(entry.item.refineLevel) : "");
  // Tope de refine configurable por admin (mismo origen que Publicar/TradeOffer).
  const [maxRefineLevel, setMaxRefineLevel] = useState(DEFAULT_MAX_REFINE_LEVEL);

  const [weaponType, setWeaponType] = useState<WeaponType | "">(entry?.weaponType ?? "");
  const [options, setOptions] = useState<OptionInput[]>(() =>
    Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => {
      const o = entry?.options.find((op) => op.slotIndex === i + 1);
      return { defId: o?.defId ?? "", minValue: o?.minValue != null ? String(o.minValue) : "" };
    }),
  );
  const [optionDefs, setOptionDefs] = useState<ItemOptionDef[]>([]);

  const [roleIds, setRoleIds] = useState<string[]>(entry?.roles.map((r) => r.id) ?? []);
  const [jobIds, setJobIds] = useState<string[]>(entry?.jobs.map((j) => j.id) ?? []);
  const [note, setNote] = useState(entry?.note ?? "");

  // Pool de options: del propio item si se elige uno (un item concreto también
  // puede llevar options); si no, por slot, o —en arma— físico/mágico según el
  // tipo de arma elegido.
  const magicalSet = useMemo(() => new Set(magicalTypes), [magicalTypes]);
  const group: ItemOptionGroup | null = selectedItem
    ? selectedItem.optionGroup
    : slot === EquipSlot.WEAPON
      ? weaponType
        ? magicalSet.has(weaponType)
          ? ItemOptionGroup.WEAPON_MAGICAL
          : ItemOptionGroup.WEAPON_PHYSICAL
        : null
      : optionGroupForSlot(slot);

  useEffect(() => {
    // La sección de options solo se pinta cuando hay `group`, así que basta con
    // cargar el pool cuando exista; no hace falta limpiar de forma síncrona.
    if (!group) return;
    let cancelled = false;
    getOptionChoices(group)
      .then((defs) => {
        if (!cancelled) setOptionDefs(defs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [group]);

  useEffect(() => {
    getMaxRefineLevel().then(setMaxRefineLevel);
  }, []);

  function emptyOptions(): OptionInput[] {
    return Array.from({ length: MAX_OPTION_SLOTS }, () => ({ defId: "", minValue: "" }));
  }
  // Al cambiar el item (o quitarlo) el pool cambia, así que las options elegidas
  // dejan de valer: se limpian.
  function chooseItem(item: ItemResult) {
    setSelectedItem(item);
    setWeaponType("");
    setOptions(emptyOptions());
  }
  function clearItem() {
    setSelectedItem(null);
    setOptions(emptyOptions());
  }

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const hasTag = roleIds.length + jobIds.length > 0;
  const hasOption = options.some((o) => o.defId !== "");
  // Algún valor pedido cae fuera del rango real de su option: no se puede guardar
  // (el servidor lo rechazaría igualmente).
  const hasOutOfRangeOption = options.some((o) => {
    if (o.defId === "" || o.minValue.trim() === "") return false;
    const def = optionDefs.find((d) => d.id === o.defId);
    return def !== undefined && (Number(o.minValue) < def.minValue || Number(o.minValue) > def.maxValue);
  });
  // Hace falta ≥1 tag y al menos uno de: item, tipo de arma u options.
  const canSubmit =
    hasTag && (selectedItem !== null || weaponType !== "" || hasOption) && !hasOutOfRangeOption;

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("stageId", stageId);
    fd.set("slot", slot);
    if (note.trim()) fd.set("note", note.trim());
    roleIds.forEach((id) => fd.append("roleIds", id));
    jobIds.forEach((id) => fd.append("jobIds", id));

    if (selectedItem) {
      fd.set("itemId", selectedItem.id);
      if (refine.trim()) fd.set("refineLevel", refine.trim());
    } else if (slot === EquipSlot.WEAPON && weaponType) {
      fd.set("weaponType", weaponType);
    }
    options.forEach((o, i) => {
      if (o.defId) {
        fd.set(`option${i + 1}DefId`, o.defId);
        if (o.minValue.trim()) fd.set(`option${i + 1}MinValue`, o.minValue.trim());
      }
    });

    startTransition(async () => {
      try {
        if (entry) await updateBisEntry(entry.id, fd);
        else await createBisEntry(fd);
        router.refresh();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, t("form.saveError")));
      }
    });
  }

  function remove() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBisEntry(entry.id);
        router.refresh();
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, t("form.saveError")));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-ro-panel-border bg-ro-panel shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-ro-panel-border bg-ro-panel-header px-4 py-3">
          <h2 className="font-heading text-sm tracking-wide text-ro-text">
            {entry ? t("form.editTitle") : t("form.addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close")}
            className="text-lg leading-none text-ro-text-muted hover:text-ro-text"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* Sub-slot (solo cabeza, al crear): upper/mid/lower. */}
          {!entry && slots.length > 1 && (
            <FloatingField label={t("form.slotLabel")}>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as EquipSlot)}
                className={floatingControlClass}
              >
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {slotLabel((k) => tMarket(k), s)}
                  </option>
                ))}
              </select>
            </FloatingField>
          )}

          {/* Item (opcional) y options (opcional): al menos uno. Un item concreto
              puede además llevar options concretas de su propio pool. */}
          <div>
            <label className={labelClass}>{t("form.itemLabel")}</label>
            <ItemPicker selected={selectedItem} onSelect={chooseItem} onClear={clearItem} slotFilter={slot} />
            <p className="mt-1 text-[0.7rem] text-ro-text-muted">{t("form.itemOrOptionHint")}</p>
          </div>

          {selectedItem && (
            <FloatingField label={t("form.refine")} className="w-1/2">
              <input
                type="number"
                min={0}
                max={maxRefineLevel}
                value={refine}
                onChange={(e) => setRefine(e.target.value)}
                placeholder="0"
                className={floatingControlClass}
              />
            </FloatingField>
          )}

          {/* Tipo de arma: solo para un BiS de arma SIN item concreto. Hace el
              BiS específico ("cualquier Daga") y fija el pool de options
              (físico/mágico) según el tipo. Con item elegido, el propio item lo
              define. */}
          {!selectedItem && slot === EquipSlot.WEAPON && (
            <FloatingField label={t("form.weaponType")}>
              <select
                value={weaponType}
                onChange={(e) => {
                  setWeaponType(e.target.value as WeaponType | "");
                  setOptions(emptyOptions());
                }}
                className={floatingControlClass}
              >
                <option value="">{t("form.weaponTypeNone")}</option>
                {WEAPON_TYPES.map((wt) => (
                  <option key={wt} value={wt}>
                    {weaponTypeLabel((k) => tMarket(k), wt)}
                  </option>
                ))}
              </select>
            </FloatingField>
          )}

          {group && (
            <div>
              <label className={labelClass}>{t("form.optionsLabel")}</label>
              <div className="flex flex-col gap-2">
                {options.map((o, i) => {
                  const defsForSlot = optionDefs.filter((d) => d.slotIndex === i + 1);
                  const def = defsForSlot.find((d) => d.id === o.defId);
                  // El valor pedido (mínimo deseado) debe caer dentro del rango
                  // real de la option [min, max]; fuera de ahí ningún item existe.
                  const outOfRange =
                    def !== undefined &&
                    o.minValue.trim() !== "" &&
                    (Number(o.minValue) < def.minValue || Number(o.minValue) > def.maxValue);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ro-accent/15 text-[0.7rem] font-bold text-ro-accent">
                        {i + 1}
                      </span>
                      <select
                        value={o.defId}
                        onChange={(e) =>
                          setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, defId: e.target.value } : p)))
                        }
                        className={`min-w-0 flex-1 ${selectClass}`}
                      >
                        <option value="">{t("form.optionNone")}</option>
                        {defsForSlot.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={o.minValue}
                        disabled={!o.defId}
                        min={def?.minValue}
                        max={def?.maxValue}
                        onChange={(e) =>
                          setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, minValue: e.target.value } : p)))
                        }
                        placeholder={
                          def
                            ? def.minValue === def.maxValue
                              ? `${def.minValue}`
                              : `${def.minValue}-${def.maxValue}`
                            : t("form.min")
                        }
                        className={`w-20 ${inputBaseClass} disabled:opacity-40`}
                        // Borde rojo inline: un className condicional pierde contra
                        // el orden con el que Tailwind genera focus:border (ver
                        // mismo patrón en PublishForm/MaskedPriceInput).
                        style={outOfRange ? { borderColor: "#dc2626" } : undefined}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[0.7rem] text-ro-text-muted">{t("form.optionsHint")}</p>
              {hasOutOfRangeOption && (
                <p className="mt-1 text-[0.7rem] text-red-600">{t("form.optionOutOfRange")}</p>
              )}
            </div>
          )}

          {/* Etiquetas: roles + jobs (multi, ≥1 en total). */}
          <TagPicker label={t("form.rolesLabel")} options={roles} selected={roleIds} onToggle={(id) => toggle(roleIds, id, setRoleIds)} />
          <TagPicker label={t("form.jobsLabel")} options={jobs} selected={jobIds} onToggle={(id) => toggle(jobIds, id, setJobIds)} />
          {!hasTag && <p className="-mt-2 text-[0.7rem] text-ro-text-muted">{t("form.needTag")}</p>}

          <FloatingField label={t("form.noteLabel")}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`resize-none ${floatingControlClass}`}
            />
          </FloatingField>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-ro-panel-border px-4 py-3">
          {entry &&
            (confirmDelete ? (
              <button type="button" onClick={remove} disabled={submitting} className={`${buttonClass("danger")} px-3`}>
                {t("form.confirmDelete")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                {t("form.delete")}
              </button>
            ))}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} disabled={submitting} className={buttonClass("secondary")}>
              {t("form.cancel")}
            </button>
            <button type="button" onClick={submit} disabled={submitting || !canSubmit} className={buttonClass("primary")}>
              {submitting ? t("form.saving") : t("form.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(o.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
                  : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted hover:border-ro-accent hover:text-ro-accent"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
