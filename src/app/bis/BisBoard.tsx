"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Boxes,
  Crown,
  Sword,
  Wind,
  Gem,
  Shirt,
  ShieldHalf,
  Footprints,
  ChevronDown,
  MessageSquareText,
  X,
  type LucideIcon,
} from "lucide-react";
import type { EquipSlot } from "@prisma/client";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount } from "@/lib/market-labels";
import { BisDetail, type BisDetailData } from "./BisDetail";

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

// Cuántos items se muestran por slot antes de "Ver todas".
const CELL_LIMIT = 4;

// Celdas del "paperdoll": imitan la ventana de equipo del juego, repartidas en
// dos columnas. La cabeza va combinada (upper/mid/lower en una sola celda). El
// resto es 1 slot por celda. Se muestran siempre, aunque no haya BiS.
type CellDef = { key: string; slots: EquipSlot[]; Icon: LucideIcon };
const LEFT_CELLS: CellDef[] = [
  { key: "head", slots: ["UPPER_HEADGEAR", "MID_HEADGEAR", "LOWER_HEADGEAR"], Icon: Crown },
  { key: "weapon", slots: ["WEAPON"], Icon: Sword },
  { key: "garment", slots: ["GARMENT"], Icon: Wind },
  { key: "accessory", slots: ["ACCESSORY"], Icon: Gem },
];
const RIGHT_CELLS: CellDef[] = [
  { key: "armor", slots: ["ARMOR"], Icon: Shirt },
  { key: "shield", slots: ["SHIELD"], Icon: ShieldHalf },
  { key: "footgear", slots: ["FOOTGEAR"], Icon: Footprints },
];
// Orden de render: relleno por columnas (grid-flow-col) → primero toda la
// columna izquierda, luego la derecha. En móvil marca el orden de apilado.
const ALL_CELLS: CellDef[] = [...LEFT_CELLS, ...RIGHT_CELLS];

// Chip de filtro (toggle). Un único valor activo por dimensión; volver a
// pulsarlo lo limpia.
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
      <span className="w-10 shrink-0 text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
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
      className={`rounded px-1 py-px text-[0.6rem] ${
        variant === "role"
          ? "bg-ro-accent/10 text-ro-accent"
          : "bg-ro-panel-border/50 text-ro-text-muted"
      }`}
    >
      {label}
    </span>
  );
}

function EntryCard({ entry, onOpen }: { entry: BisEntryView; onOpen: () => void }) {
  const t = useTranslations("bis");

  const iconBox = entry.item ? (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
      <Image src={entry.item.iconUrl} alt={entry.item.name} width={26} height={26} />
    </div>
  ) : (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-dashed border-ro-panel-border bg-ro-panel text-ro-text-muted">
      <Boxes size={15} aria-hidden />
    </div>
  );

  const title = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
    : t("anyItem");

  // La card abre el detalle (panel/bottom sheet). La nota ya no va inline: se
  // señala con el icono de bocadillo en la esquina (como en los listings) y su
  // texto completo se ve en el detalle.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-full min-h-[3.5rem] w-full gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2 text-left transition-colors hover:border-ro-accent"
    >
      {iconBox}
      <div className="min-w-0 flex-1">
        <p className={`truncate pr-4 text-xs font-bold ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}>
          {title}
        </p>

        {entry.options.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.options.map((o) => (
              <span
                key={o.slotIndex}
                className="rounded border border-ro-accent/30 bg-ro-accent/10 px-1 py-px text-[0.6rem] text-ro-accent"
              >
                {o.label}
                {o.minValue !== null ? ` ${formatOptionAmount(o.minValue, true)}` : ""}
              </span>
            ))}
          </div>
        )}

        {(entry.roles.length > 0 || entry.jobs.length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.roles.map((r) => (
              <TagBadge key={r.id} label={r.label} variant="role" />
            ))}
            {entry.jobs.map((j) => (
              <TagBadge key={j.id} label={j.label} variant="job" />
            ))}
          </div>
        )}
      </div>

      {entry.note && (
        <span
          aria-label={t("detail.note")}
          className="absolute right-1.5 top-1.5 text-ro-text-muted"
        >
          <MessageSquareText size={13} aria-hidden />
        </span>
      )}
    </button>
  );
}

// Una celda de slot del paperdoll: cabecera (icono + nombre) y sus items. Vacía
// muestra un aviso en gris; si hay más de CELL_LIMIT, un botón las despliega.
function SlotCell({
  def,
  label,
  all,
  shown,
  onOpen,
}: {
  def: CellDef;
  label: string;
  all: BisEntryView[];
  shown: BisEntryView[];
  onOpen: (entry: BisEntryView) => void;
}) {
  const t = useTranslations("bis");
  const [expanded, setExpanded] = useState(false);
  const { Icon } = def;

  const overLimit = shown.length > CELL_LIMIT;
  const visible = expanded ? shown : shown.slice(0, CELL_LIMIT);

  return (
    <section className="flex h-full flex-col rounded-xl border border-ro-panel-border bg-ro-panel p-3">
      <header className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ro-accent/10 text-ro-accent">
          <Icon size={16} aria-hidden />
        </span>
        <h3 className="font-heading text-xs tracking-wide text-ro-text">{label}</h3>
        {shown.length > 0 && (
          <span className="ml-auto text-[0.65rem] font-semibold text-ro-text-muted">{shown.length}</span>
        )}
      </header>

      {shown.length === 0 ? (
        <p className="py-1 text-xs italic text-ro-text-muted">
          {all.length === 0 ? t("cell.empty") : t("cell.noMatches")}
        </p>
      ) : (
        <>
          <ul className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
            {visible.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} onOpen={() => onOpen(entry)} />
              </li>
            ))}
          </ul>
          {overLimit && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ro-accent hover:underline"
            >
              <ChevronDown size={13} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
              {expanded ? t("showLess") : t("showAll", { count: shown.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function BisBoard({
  entries,
  roles,
  jobs,
}: {
  entries: BisEntryView[];
  roles: Tag[];
  jobs: Tag[];
}) {
  const t = useTranslations("bis");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  // Entrada abierta en el detalle (panel/bottom sheet); guarda también el
  // nombre de su celda (slot), que la propia entrada no conoce como texto.
  const [selected, setSelected] = useState<BisDetailData | null>(null);

  function toggle(current: string | null, next: string, set: (v: string | null) => void) {
    set(current === next ? null : next);
  }

  // Rol y job filtran las cards (AND entre dimensiones). Una entrada casa si
  // lleva ese rol/job entre sus etiquetas.
  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!activeRole || e.roles.some((r) => r.id === activeRole)) &&
          (!activeJob || e.jobs.some((j) => j.id === activeJob)),
      ),
    [entries, activeRole, activeJob],
  );

  const hasFilters = activeRole !== null || activeJob !== null;

  function renderCell(def: CellDef) {
    const label = t(`cells.${def.key}`);
    const all = entries.filter((e) => def.slots.includes(e.slot));
    const shown = filtered.filter((e) => def.slots.includes(e.slot));
    return (
      <SlotCell
        key={def.key}
        def={def}
        label={label}
        all={all}
        shown={shown}
        onOpen={(entry) => setSelected({ entry, slotLabel: label, slotIcon: def.Icon })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 rounded-xl border border-ro-panel-border bg-ro-panel p-4">
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

      {/* Paperdoll: en desktop, rejilla de 2 columnas × 4 filas rellenada por
          columnas (izquierda: cabeza, arma, manto, accesorio; derecha:
          armadura, escudo, calzado). Las filas son 1fr, así todas las celdas
          ocupan lo mismo. En móvil se apilan en una sola columna. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-4">
        {ALL_CELLS.map(renderCell)}
      </div>

      {selected && <BisDetail data={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
