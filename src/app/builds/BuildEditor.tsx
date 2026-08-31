"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { ItemPicker } from "@/app/market/ItemPicker";
import { CardPicker } from "./CardPicker";
import type { BuildSlot, BuildTag, ItemOptionGroup } from "@/db/enums";
import { BUILD_TAG_VALUES } from "@/db/enums";
import { MAX_OPTION_SLOTS, emptyOptionSelections, type OptionSelection } from "@/lib/item-options-constants";
import {
  BUILD_SLOTS,
  buildSlotToEquipSlot,
  BUILD_SLOT_POSITION,
  MAX_BUILD_NAME_LENGTH,
  MAX_BUILD_NOTES_LENGTH,
} from "@/lib/build-constants";
import { createBuild, updateBuild, deleteBuild, type BuildInput } from "@/lib/builds";
import { getErrorMessage } from "@/lib/errors";
import { buttonClass, inputClass } from "@/lib/ui";

export type OptionDef = {
  id: string;
  group: string;
  slotIndex: number;
  label: string;
  minValue: number;
  maxValue: number;
};
type JobOption = { id: number; name: string };
type SlotItem = { id: string; name: string; iconUrl: string; slotCount: number; optionGroup: ItemOptionGroup | null };
type CardSel = { id: string; name: string; iconUrl: string } | null;
export type SlotState = { item: SlotItem; refine: number; options: OptionSelection[]; cards: CardSel[] };

export type BuildEditorInitial = {
  id: string;
  name: string;
  jobId: number;
  tags: BuildTag[];
  notes: string | null;
  slots: Partial<Record<BuildSlot, SlotState>>;
};

export function BuildEditor({
  jobs,
  maxRefine,
  optionDefs,
  initial,
}: {
  jobs: { first: JobOption[]; second: JobOption[] };
  maxRefine: number;
  optionDefs: OptionDef[];
  initial?: BuildEditorInitial;
}) {
  const t = useTranslations("builds.form");
  const tTag = useTranslations("builds.tags");
  const router = useRouter();
  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [jobId, setJobId] = useState<number | null>(initial?.jobId ?? null);
  const [tags, setTags] = useState<BuildTag[]>(initial?.tags ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [slots, setSlots] = useState<Partial<Record<BuildSlot, SlotState>>>(initial?.slots ?? {});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: BuildTag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }
  function patchSlot(slot: BuildSlot, patch: Partial<SlotState>) {
    setSlots((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot]!, ...patch } } : prev));
  }
  function pickItem(slot: BuildSlot, item: SlotItem) {
    setSlots((prev) => ({
      ...prev,
      [slot]: {
        item,
        refine: prev[slot]?.refine ?? 0,
        options: emptyOptionSelections(),
        cards: Array.from({ length: item.slotCount }, () => null),
      },
    }));
  }
  // Cambiar el item de un slot YA relleno conservando refino, options y cartas
  // (las cartas se redimensionan al slotCount del item nuevo: se mantienen las
  // que caben y se rellenan con vacío si el nuevo admite más).
  function changeItem(slot: BuildSlot, item: SlotItem) {
    setSlots((prev) => {
      const s = prev[slot];
      if (!s) return { ...prev, [slot]: { item, refine: 0, options: emptyOptionSelections(), cards: Array.from({ length: item.slotCount }, () => null) } };
      const cards = Array.from({ length: item.slotCount }, (_, i) => s.cards[i] ?? null);
      return { ...prev, [slot]: { ...s, item, cards } };
    });
  }
  function clearSlot(slot: BuildSlot) {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  const canSave = name.trim().length > 0 && jobId !== null && tags.length > 0 && !isPending;

  function save() {
    if (jobId === null) return;
    setError(null);
    const input: BuildInput = {
      name: name.trim(),
      jobId,
      tags,
      notes: notes.trim() || null,
      entries: BUILD_SLOTS.flatMap((slot) => {
        const s = slots[slot];
        if (!s) return [];
        const options = s.options
          .map((o, i) => ({ slotIndex: i + 1, defId: o.defId, value: o.value }))
          .filter((o) => o.defId !== "" && o.value !== "")
          .map((o) => ({ slotIndex: o.slotIndex, defId: o.defId, value: Number(o.value) }));
        const cards = s.cards
          .map((c, i) => (c ? { slotIndex: i, cardItemId: c.id } : null))
          .filter((c): c is { slotIndex: number; cardItemId: string } => c !== null);
        return [{ slot, itemId: s.item.id, refineLevel: s.refine, options, cards }];
      }),
    };
    startTransition(async () => {
      try {
        const res = isEdit ? await updateBuild(initial!.id, input) : await createBuild(input);
        router.push(`/builds/${res.id}`);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  function remove() {
    if (!initial) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBuild(initial.id);
        router.push("/builds");
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ro-text">{t("nameLabel")}</span>
          <input
            type="text"
            value={name}
            maxLength={MAX_BUILD_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ro-text">{t("classLabel")}</span>
          <select
            value={jobId ?? ""}
            onChange={(e) => setJobId(e.target.value ? Number(e.target.value) : null)}
            className={inputClass}
          >
            <option value="">{t("chooseClass")}</option>
            <optgroup label={t("firstJobs")}>
              {jobs.first.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </optgroup>
            <optgroup label={t("secondJobs")}>
              {jobs.second.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-ro-text">{t("tagsLabel")}</span>
        <div className="flex gap-2">
          {BUILD_TAG_VALUES.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "border-ro-accent bg-ro-accent/15 text-ro-accent" : "border-ro-panel-border text-ro-text-muted hover:text-ro-text"
                }`}
              >
                {tTag(tag)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-ro-text">{t("notesLabel")}</span>
        <textarea
          value={notes}
          maxLength={MAX_BUILD_NOTES_LENGTH}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ro-text">{t("slotsLabel")}</span>
        <ul className="flex flex-col gap-2">
          {BUILD_SLOTS.map((slot) => (
            <li key={slot}>
              <BuildSlotRow
                slot={slot}
                state={slots[slot]}
                optionDefs={optionDefs}
                maxRefine={maxRefine}
                onPick={(item) => pickItem(slot, item)}
                onChangeItem={(item) => changeItem(slot, item)}
                onClear={() => clearSlot(slot)}
                onPatch={(patch) => patchSlot(slot, patch)}
              />
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canSave} onClick={save} className={buttonClass("primary")}>
          {isPending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={() => router.back()} className={buttonClass("outline")}>
          {t("cancel")}
        </button>
        {isEdit && (
          <button type="button" onClick={remove} disabled={isPending} className={`ml-auto ${buttonClass("outline")} text-red-700`}>
            {t("deleteBuild")}
          </button>
        )}
      </div>
    </div>
  );
}

function BuildSlotRow({
  slot,
  state,
  optionDefs,
  maxRefine,
  onPick,
  onChangeItem,
  onClear,
  onPatch,
}: {
  slot: BuildSlot;
  state: SlotState | undefined;
  optionDefs: OptionDef[];
  maxRefine: number;
  onPick: (item: SlotItem) => void;
  onChangeItem: (item: SlotItem) => void;
  onClear: () => void;
  onPatch: (patch: Partial<SlotState>) => void;
}) {
  const t = useTranslations("builds.form");
  const tSlot = useTranslations("builds.slots");
  const [changing, setChanging] = useState(false);

  if (!state) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2">
        <span className="w-28 shrink-0 text-xs font-semibold text-ro-text-muted">{tSlot(slot)}</span>
        <div className="min-w-0 flex-1">
          <ItemPicker
            selected={null}
            onSelect={(item) =>
              onPick({ id: item.id, name: item.name, iconUrl: item.iconUrl, slotCount: item.slotCount, optionGroup: item.optionGroup })
            }
            onClear={() => {}}
            slotFilter={buildSlotToEquipSlot(slot)}
            positionFilter={BUILD_SLOT_POSITION[slot]}
          />
        </div>
      </div>
    );
  }

  function setOption(index: number, patch: Partial<OptionSelection>) {
    const next = state!.options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    // Al vaciar un slot de option, se limpian los siguientes (sin huecos).
    if (patch.defId === "") {
      for (let i = index + 1; i < next.length; i++) next[i] = { defId: "", value: "" };
    }
    onPatch({ options: next });
  }
  function setCard(index: number, card: CardSel) {
    onPatch({ cards: state!.cards.map((c, i) => (i === index ? card : c)) });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2">
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-semibold text-ro-text-muted">{tSlot(slot)}</span>
        {changing ? (
          // Cambiar item conservando refino/options/cartas: buscador inline. Al
          // elegir, se sustituye el item (onChangeItem) y se sale del modo.
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <ItemPicker
                selected={null}
                onSelect={(item) => {
                  onChangeItem({ id: item.id, name: item.name, iconUrl: item.iconUrl, slotCount: item.slotCount, optionGroup: item.optionGroup });
                  setChanging(false);
                }}
                onClear={() => {}}
                slotFilter={buildSlotToEquipSlot(slot)}
                positionFilter={BUILD_SLOT_POSITION[slot]}
              />
            </div>
            <button
              type="button"
              onClick={() => setChanging(false)}
              className="shrink-0 text-xs font-medium text-ro-text-muted hover:text-ro-text"
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <>
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
              <ItemIcon item={state.item} width={28} height={28} refine={state.refine} alt="" />
            </div>
            <p className="min-w-0 flex-1 truncate text-sm text-ro-text">{state.item.name}</p>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="shrink-0 text-xs font-medium text-ro-accent hover:underline"
            >
              {t("changeItem")}
            </button>
            <label className="flex items-center gap-1 text-xs text-ro-text-muted">
              {t("refine")}
              <input
                type="number"
                min={0}
                max={maxRefine}
                value={state.refine}
                onChange={(e) => onPatch({ refine: Math.max(0, Math.min(maxRefine, Number(e.target.value) || 0)) })}
                className={`${inputClass} h-8 w-16`}
              />
            </label>
            <button
              type="button"
              onClick={onClear}
              aria-label={t("remove")}
              title={t("remove")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ro-text-muted hover:bg-ro-panel hover:text-ro-text"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>

      {/* Options (si el item tiene grupo de options) */}
      {state.item.optionGroup && (
        <div className="flex flex-col gap-1.5 pl-28">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ro-text-muted">{t("optionsLabel")}</span>
          {Array.from({ length: MAX_OPTION_SLOTS }, (_, i) => i + 1).map((slotIndex) => {
            const index = slotIndex - 1;
            const sel = state.options[index];
            const enabled = index === 0 || state.options[index - 1].defId !== "";
            const defsForSlot = optionDefs.filter((d) => d.group === state.item.optionGroup && d.slotIndex === slotIndex);
            const def = defsForSlot.find((d) => d.id === sel.defId);
            return (
              <div key={slotIndex} className="flex items-center gap-2">
                <select
                  value={sel.defId}
                  disabled={!enabled}
                  onChange={(e) => setOption(index, { defId: e.target.value, value: "" })}
                  className={`min-w-0 flex-1 ${inputClass} h-8 text-sm disabled:opacity-50`}
                >
                  <option value="">{t("optionPlaceholder", { slot: slotIndex })}</option>
                  {defsForSlot.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={def?.minValue}
                  max={def?.maxValue}
                  placeholder={def ? `${def.minValue}-${def.maxValue}` : undefined}
                  value={sel.value}
                  disabled={!sel.defId}
                  onChange={(e) => setOption(index, { value: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`${inputClass} h-8 w-24 text-sm disabled:opacity-50`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Cartas (una por ranura, hasta slotCount) */}
      {state.item.slotCount > 0 && (
        <div className="flex flex-col gap-1.5 pl-28">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ro-text-muted">{t("cardsLabel")}</span>
          {state.cards.map((card, i) => (
            <div key={i}>
              {card ? (
                <div className="flex h-9 items-center gap-2 rounded-lg border border-ro-accent/40 bg-ro-accent/10 px-2">
                  <ItemIcon item={card} width={22} height={22} alt="" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ro-text">{card.name}</span>
                  <button type="button" onClick={() => setCard(i, null)} aria-label={t("remove")} title={t("remove")} className="shrink-0 text-ro-text-muted hover:text-ro-text">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <CardPicker
                  placeholder={t("cardPlaceholder", { n: i + 1 })}
                  onSelect={(c) => setCard(i, { id: c.id, name: c.name, iconUrl: c.iconUrl })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
