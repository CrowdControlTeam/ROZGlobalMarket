"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Boxes, X } from "lucide-react";
import type { EquipSlot } from "@prisma/client";
import { Panel } from "@/components/Panel";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount } from "@/lib/market-labels";

type Tag = { id: string; label: string };

export type BisEntryView = {
  id: string;
  slot: EquipSlot;
  note: string | null;
  // Item concreto (con su refine/slots ya resueltos) o null = BiS genérico
  // ("cualquier pieza con estas options").
  item: { name: string; iconUrl: string; refineLevel: number; cardSlots: number } | null;
  options: { slotIndex: number; minValue: number | null; label: string }[];
  roles: Tag[];
  jobs: Tag[];
};

// Chip de filtro (toggle). Un único valor activo por dimensión; volver a
// pulsarlo lo limpia.
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
          : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted hover:border-ro-accent hover:text-ro-accent"
      }`}
    >
      {label}
    </button>
  );
}

function FilterRow({
  legend,
  options,
  activeId,
  onToggle,
}: {
  legend: string;
  options: { id: string; label: string }[];
  activeId: string | null;
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
        {legend}
      </span>
      {options.map((o) => (
        <FilterChip key={o.id} label={o.label} active={activeId === o.id} onClick={() => onToggle(o.id)} />
      ))}
    </div>
  );
}

// Badge de etiqueta (rol/job) dentro de una entrada. Rol tintado de acento,
// job en neutro, para distinguirlos de un vistazo.
function TagBadge({ label, variant }: { label: string; variant: "role" | "job" }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[0.65rem] ${
        variant === "role"
          ? "border-ro-accent/40 bg-ro-accent/10 text-ro-accent"
          : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted"
      }`}
    >
      {label}
    </span>
  );
}

function EntryCard({ entry, slotLabel }: { entry: BisEntryView; slotLabel: string }) {
  const t = useTranslations("bis");

  const iconBox = entry.item ? (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-ro-panel-border bg-ro-panel-alt">
      <Image src={entry.item.iconUrl} alt={entry.item.name} width={32} height={32} />
    </div>
  ) : (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashed border-ro-panel-border bg-ro-panel-alt text-ro-text-muted">
      <Boxes size={18} aria-hidden />
    </div>
  );

  const title = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
    : t("anyItem", { slot: slotLabel.toLowerCase() });

  const optionChips =
    entry.options.length > 0 ? (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {entry.options.map((o) => (
          <span
            key={o.slotIndex}
            className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1.5 py-0.5 text-[0.65rem] text-ro-accent"
          >
            {o.label}{" "}
            {o.minValue !== null ? formatOptionAmount(o.minValue, true) : t("optionAnyValue")}
          </span>
        ))}
      </div>
    ) : null;

  const tags =
    entry.roles.length > 0 || entry.jobs.length > 0 ? (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {entry.roles.map((r) => (
          <TagBadge key={r.id} label={r.label} variant="role" />
        ))}
        {entry.jobs.map((j) => (
          <TagBadge key={j.id} label={j.label} variant="job" />
        ))}
      </div>
    ) : null;

  return (
    <div className="flex gap-3 rounded-xl border border-ro-panel-border bg-ro-panel-alt p-3">
      {iconBox}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}>
          {title}
        </p>
        {optionChips}
        {tags}
        {entry.note && <p className="mt-1.5 text-xs italic text-ro-text-muted">{entry.note}</p>}
      </div>
    </div>
  );
}

export function BisBoard({
  entries,
  roles,
  jobs,
  slotOrder,
  slotLabels,
}: {
  entries: BisEntryView[];
  roles: Tag[];
  jobs: Tag[];
  slotOrder: EquipSlot[];
  slotLabels: Record<EquipSlot, string>;
}) {
  const t = useTranslations("bis");
  const [activeSlot, setActiveSlot] = useState<EquipSlot | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<string | null>(null);

  function toggle<TVal>(current: TVal | null, next: TVal, set: (v: TVal | null) => void) {
    set(current === next ? null : next);
  }

  // Solo se ofrecen como filtro los slots que tienen alguna entrada en esta
  // etapa (evita chips que no llevan a nada).
  const slotsWithEntries = useMemo(
    () => slotOrder.filter((s) => entries.some((e) => e.slot === s)),
    [slotOrder, entries],
  );

  // Rol/job filtran las entradas (AND entre dimensiones); el slot decide qué
  // secciones se muestran. Una entrada casa un filtro de rol/job si lo lleva
  // entre sus etiquetas.
  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!activeRole || e.roles.some((r) => r.id === activeRole)) &&
          (!activeJob || e.jobs.some((j) => j.id === activeJob)),
      ),
    [entries, activeRole, activeJob],
  );

  const visibleSlots = activeSlot ? [activeSlot] : slotsWithEntries;
  const sections = visibleSlots
    .map((slot) => ({ slot, items: filtered.filter((e) => e.slot === slot) }))
    .filter((s) => s.items.length > 0);

  const hasFilters = activeSlot !== null || activeRole !== null || activeJob !== null;

  if (entries.length === 0) {
    return <p className="text-ro-text-muted">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 rounded-xl border border-ro-panel-border bg-ro-panel p-4">
        <FilterRow
          legend={t("filters.slotLegend")}
          options={slotsWithEntries.map((s) => ({ id: s, label: slotLabels[s] }))}
          activeId={activeSlot}
          onToggle={(id) => toggle(activeSlot, id as EquipSlot, setActiveSlot)}
        />
        <FilterRow
          legend={t("filters.roleLegend")}
          options={roles}
          activeId={activeRole}
          onToggle={(id) => toggle(activeRole, id, setActiveRole)}
        />
        <FilterRow
          legend={t("filters.jobLegend")}
          options={jobs}
          activeId={activeJob}
          onToggle={(id) => toggle(activeJob, id, setActiveJob)}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setActiveSlot(null);
              setActiveRole(null);
              setActiveJob(null);
            }}
            className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs text-ro-text-muted hover:text-ro-accent"
          >
            <X size={12} aria-hidden />
            {t("filters.clear")}
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="text-ro-text-muted">{t("noMatches")}</p>
      ) : (
        sections.map(({ slot, items }) => (
          <Panel key={slot} title={slotLabels[slot]}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((entry) => (
                <li key={entry.id}>
                  <EntryCard entry={entry} slotLabel={slotLabels[slot]} />
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
