"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import { ItemPicker } from "@/app/market/ItemPicker";
import type { BuildSlot, BuildTag } from "@/db/enums";
import { BUILD_TAG_VALUES } from "@/db/enums";
import {
  BUILD_SLOTS,
  buildSlotToEquipSlot,
  MAX_BUILD_NAME_LENGTH,
  MAX_BUILD_NOTES_LENGTH,
} from "@/lib/build-constants";
import { createBuild, updateBuild, deleteBuild, type BuildInput } from "@/lib/builds";
import { getErrorMessage } from "@/lib/errors";
import { buttonClass, inputClass } from "@/lib/ui";

type JobOption = { id: number; name: string };
type SlotItem = { id: string; name: string; iconUrl: string; slotCount: number };
type SlotState = { item: SlotItem; refine: number };

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
  initial,
}: {
  jobs: { first: JobOption[]; second: JobOption[] };
  maxRefine: number;
  initial?: BuildEditorInitial;
}) {
  const t = useTranslations("builds.form");
  const tSlot = useTranslations("builds.slots");
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
  function setSlotItem(slot: BuildSlot, item: SlotItem) {
    setSlots((prev) => ({ ...prev, [slot]: { item, refine: prev[slot]?.refine ?? 0 } }));
  }
  function clearSlot(slot: BuildSlot) {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }
  function setSlotRefine(slot: BuildSlot, refine: number) {
    setSlots((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot]!, refine } } : prev));
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
        return s ? [{ slot, itemId: s.item.id, refineLevel: s.refine }] : [];
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
      {/* Datos generales */}
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

      {/* Tags */}
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
                  on
                    ? "border-ro-accent bg-ro-accent/15 text-ro-accent"
                    : "border-ro-panel-border text-ro-text-muted hover:text-ro-text"
                }`}
              >
                {tTag(tag)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notas */}
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

      {/* Piezas por slot */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ro-text">{t("slotsLabel")}</span>
        <ul className="flex flex-col gap-2">
          {BUILD_SLOTS.map((slot) => {
            const s = slots[slot];
            return (
              <li key={slot} className="flex items-center gap-3 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2">
                <span className="w-28 shrink-0 text-xs font-semibold text-ro-text-muted">{tSlot(slot)}</span>
                <div className="min-w-0 flex-1">
                  {s ? (
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
                        <ItemIcon item={s.item} width={28} height={28} refine={s.refine} alt="" />
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm text-ro-text">{s.item.name}</p>
                      <label className="flex items-center gap-1 text-xs text-ro-text-muted">
                        {t("refine")}
                        <input
                          type="number"
                          min={0}
                          max={maxRefine}
                          value={s.refine}
                          onChange={(e) => setSlotRefine(slot, Math.max(0, Math.min(maxRefine, Number(e.target.value) || 0)))}
                          className={`${inputClass} h-8 w-16`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => clearSlot(slot)}
                        aria-label={t("remove")}
                        title={t("remove")}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ro-text-muted hover:bg-ro-panel hover:text-ro-text"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <ItemPicker
                      selected={null}
                      onSelect={(item) =>
                        setSlotItem(slot, { id: item.id, name: item.name, iconUrl: item.iconUrl, slotCount: item.slotCount })
                      }
                      onClear={() => {}}
                      slotFilter={buildSlotToEquipSlot(slot)}
                    />
                  )}
                </div>
              </li>
            );
          })}
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
