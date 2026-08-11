"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EquipSlot, ItemOptionGroup, type ItemOptionDef } from "@prisma/client";
import { ItemPicker, type ItemResult } from "@/app/market/new/ItemPicker";
import { getOptionChoices } from "@/lib/listings";
import { createBisEntry, updateBisEntry, deleteBisEntry } from "@/lib/bis-actions";
import { optionGroupForSlot, slotSupportsGeneric } from "@/lib/bis-constants";
import { getMaxCardSlots } from "@/lib/card-slots-constants";
import { MAX_OPTION_SLOTS } from "@/lib/item-options-constants";
import { getErrorMessage } from "@/lib/errors";
import { slotLabel } from "@/lib/market-labels";
import { buttonClass, inputBaseClass, selectClass, labelClass } from "@/lib/ui";
import type { Tag, BisEntryView, BisEntryItem } from "./BisBoard";

type Mode = "CONCRETE" | "GENERIC";
type WeaponClass = "PHYSICAL" | "MAGICAL" | "";
type OptionInput = { defId: string; minValue: string };

function toItemResult(item: BisEntryItem): ItemResult {
  return {
    id: item.id,
    name: item.name,
    iconUrl: item.iconUrl,
    category: item.category,
    slot: item.slot,
    weaponType: item.weaponType,
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
  onClose,
}: {
  stageId: string;
  // Slots del cell: 1 (la mayoría) o varios (cabeza = upper/mid/lower).
  slots: EquipSlot[];
  entry: BisEntryView | null;
  roles: Tag[];
  jobs: Tag[];
  onClose: () => void;
}) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const router = useRouter();
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [slot, setSlot] = useState<EquipSlot>(entry?.slot ?? slots[0]);
  const supportsGeneric = slotSupportsGeneric(slot);
  const [mode, setMode] = useState<Mode>(entry ? (entry.item ? "CONCRETE" : "GENERIC") : "CONCRETE");

  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(
    entry?.item ? toItemResult(entry.item) : null,
  );
  const [refine, setRefine] = useState(entry?.item?.refineLevel ? String(entry.item.refineLevel) : "");
  const [cardSlots, setCardSlots] = useState(entry?.item?.cardSlots ? String(entry.item.cardSlots) : "");

  const initGroup = entry?.optionGroup ?? null;
  const [weaponClass, setWeaponClass] = useState<WeaponClass>(
    initGroup === "WEAPON_PHYSICAL" ? "PHYSICAL" : initGroup === "WEAPON_MAGICAL" ? "MAGICAL" : "",
  );
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

  // Grupo de options efectivo (genérico): por slot, o físico/mágico en arma.
  const group: ItemOptionGroup | null =
    mode !== "GENERIC"
      ? null
      : slot === EquipSlot.WEAPON
        ? weaponClass === "PHYSICAL"
          ? ItemOptionGroup.WEAPON_PHYSICAL
          : weaponClass === "MAGICAL"
            ? ItemOptionGroup.WEAPON_MAGICAL
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

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const maxCardSlots = selectedItem ? getMaxCardSlots(selectedItem) : 0;
  const hasTag = roleIds.length + jobIds.length > 0;
  const hasOption = options.some((o) => o.defId !== "");
  const canSubmit =
    hasTag &&
    (mode === "CONCRETE"
      ? selectedItem !== null
      : group !== null && hasOption);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("stageId", stageId);
    fd.set("slot", slot);
    fd.set("mode", mode);
    if (note.trim()) fd.set("note", note.trim());
    roleIds.forEach((id) => fd.append("roleIds", id));
    jobIds.forEach((id) => fd.append("jobIds", id));

    if (mode === "CONCRETE") {
      if (selectedItem) fd.set("itemId", selectedItem.id);
      if (refine.trim()) fd.set("refineLevel", refine.trim());
      if (cardSlots.trim()) fd.set("cardSlots", cardSlots.trim());
    } else {
      if (slot === EquipSlot.WEAPON && weaponClass) fd.set("weaponClass", weaponClass);
      options.forEach((o, i) => {
        if (o.defId) {
          fd.set(`option${i + 1}DefId`, o.defId);
          if (o.minValue.trim()) fd.set(`option${i + 1}MinValue`, o.minValue.trim());
        }
      });
    }

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
            <div>
              <label className={labelClass}>{t("form.slotLabel")}</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as EquipSlot)}
                className={`w-full ${selectClass}`}
              >
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {slotLabel((k) => tMarket(k), s)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Modo: concreto vs genérico (solo si el slot admite options). */}
          {supportsGeneric && (
            <div className="flex gap-1.5 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-1">
              {(["CONCRETE", "GENERIC"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    mode === m ? "bg-ro-accent/15 text-ro-accent" : "text-ro-text-muted hover:text-ro-text"
                  }`}
                >
                  {t(m === "CONCRETE" ? "form.modeConcrete" : "form.modeGeneric")}
                </button>
              ))}
            </div>
          )}

          {mode === "CONCRETE" ? (
            <>
              <div>
                <label className={labelClass}>{t("form.itemLabel")}</label>
                <ItemPicker
                  selected={selectedItem}
                  onSelect={setSelectedItem}
                  onClear={() => setSelectedItem(null)}
                />
              </div>
              {selectedItem && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("form.refine")}</label>
                    <input
                      type="number"
                      min={0}
                      value={refine}
                      onChange={(e) => setRefine(e.target.value)}
                      placeholder="0"
                      className={`w-full ${inputBaseClass}`}
                    />
                  </div>
                  {maxCardSlots > 0 && (
                    <div>
                      <label className={labelClass}>{t("form.cardSlots")}</label>
                      <input
                        type="number"
                        min={0}
                        max={maxCardSlots}
                        value={cardSlots}
                        onChange={(e) => setCardSlots(e.target.value)}
                        placeholder="0"
                        className={`w-full ${inputBaseClass}`}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {slot === EquipSlot.WEAPON && (
                <div>
                  <label className={labelClass}>{t("form.weaponClass")}</label>
                  <div className="flex gap-1.5 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-1">
                    {(["PHYSICAL", "MAGICAL"] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setWeaponClass(w);
                          // Al cambiar de pool, las options elegidas dejan de valer.
                          setOptions(Array.from({ length: MAX_OPTION_SLOTS }, () => ({ defId: "", minValue: "" })));
                        }}
                        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                          weaponClass === w ? "bg-ro-accent/15 text-ro-accent" : "text-ro-text-muted hover:text-ro-text"
                        }`}
                      >
                        {t(w === "PHYSICAL" ? "form.physical" : "form.magical")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {group && (
                <div>
                  <label className={labelClass}>{t("form.optionsLabel")}</label>
                  <div className="flex flex-col gap-2">
                    {options.map((o, i) => {
                      const defsForSlot = optionDefs.filter((d) => d.slotIndex === i + 1);
                      const def = defsForSlot.find((d) => d.id === o.defId);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ro-accent/15 text-[0.7rem] font-bold text-ro-accent">
                            {i + 1}
                          </span>
                          <select
                            value={o.defId}
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, defId: e.target.value } : p)),
                              )
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
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, minValue: e.target.value } : p)),
                              )
                            }
                            placeholder={def ? `${def.minValue}` : t("form.min")}
                            className={`w-20 ${inputBaseClass} disabled:opacity-40`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[0.7rem] text-ro-text-muted">{t("form.optionsHint")}</p>
                </div>
              )}
            </>
          )}

          {/* Etiquetas: roles + jobs (multi, ≥1 en total). */}
          <TagPicker label={t("form.rolesLabel")} options={roles} selected={roleIds} onToggle={(id) => toggle(roleIds, id, setRoleIds)} />
          <TagPicker label={t("form.jobsLabel")} options={jobs} selected={jobIds} onToggle={(id) => toggle(jobIds, id, setJobIds)} />
          {!hasTag && <p className="-mt-2 text-[0.7rem] text-ro-text-muted">{t("form.needTag")}</p>}

          <div>
            <label className={labelClass}>{t("form.noteLabel")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`w-full resize-none ${inputBaseClass}`}
            />
          </div>

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
