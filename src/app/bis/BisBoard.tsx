"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemIcon } from "@/components/ItemIcon";
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
  GripVertical,
  Plus,
  Pencil,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EquipSlot, ItemCategory, ItemOptionGroup, WeaponType } from "@prisma/client";
import { formatItemDisplayName } from "@/lib/card-slots-constants";
import { formatOptionAmount, weaponTypeLabel } from "@/lib/market-labels";
import { reorderBisEntries, deleteBisEntry } from "@/lib/bis-actions";
import { buttonClass } from "@/lib/ui";
import { KebabMenu } from "@/components/KebabMenu";
import { NoteIndicator } from "@/components/NoteIndicator";
import { bisEntryMarketQuery } from "./bis-market-link";
import { BisDetail, type BisDetailData } from "./BisDetail";
import { BisEntryForm } from "./BisEntryForm";

export type Tag = { id: string; label: string };

// Item concreto de un BiS: además de lo que pinta la card (name/icon/refine/
// slots), lleva lo que necesita el editor (id + category/slot/weaponType para
// validar y calcular slots, optionGroup ya resuelto). null = BiS genérico.
export type BisEntryItem = {
  id: string;
  name: string;
  iconUrl: string;
  category: ItemCategory;
  slot: EquipSlot | null;
  weaponType: WeaponType | null;
  optionGroup: ItemOptionGroup | null;
  refineLevel: number;
  cardSlots: number;
};

export type BisEntryView = {
  id: string;
  slot: EquipSlot;
  note: string | null;
  item: BisEntryItem | null;
  // Tipo de arma de un BiS genérico de arma ("cualquier Daga"); null en el resto.
  weaponType: WeaponType | null;
  // Grupo de options de un BiS genérico (null en los concretos). Sirve al editor
  // para recargar el pool correcto y, en arma, saber si es físico o mágico.
  optionGroup: ItemOptionGroup | null;
  options: { slotIndex: number; defId: string; minValue: number | null; label: string; statCode: string }[];
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
  { key: "head", slots: ["HEADGEAR"], Icon: Crown },
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
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "border-ro-accent bg-ro-accent/10 text-ro-accent"
          : "border-ro-panel-border bg-ro-panel-alt text-ro-text-muted hover:border-ro-accent hover:text-ro-accent"
      }`}
    >
      {label}
    </button>
  );
}

// Un grupo de filtro (Rol o Job): leyenda + chips, en línea. Los grupos se
// colocan lado a lado en desktop y se apilan en móvil (sin caja pesada), así
// que todo sigue visible a un clic pero ocupa mucho menos.
function FilterGroup({
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ro-text-muted">{legend}</span>
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

function EntryCard({
  entry,
  onOpen,
  canEdit,
  onEdit,
  onDelete,
  draggable = false,
}: {
  entry: BisEntryView;
  onOpen: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  // Muestra el asa de arrastre (grip) a la izquierda. Solo en cards que de
  // verdad se pueden reordenar (celda con DnD activo).
  draggable?: boolean;
}) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const router = useRouter();

  const iconBox = entry.item ? (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
      <ItemIcon item={entry.item} width={26} height={26} />
    </div>
  ) : (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-dashed border-ro-panel-border bg-ro-panel text-ro-text-muted">
      <Boxes size={15} aria-hidden />
    </div>
  );

  const title = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
    : entry.weaponType
      ? weaponTypeLabel(tMarket, entry.weaponType)
      : t("anyItem");

  // La card abre el detalle (panel/bottom sheet). El kebab (para todos los
  // usuarios) lleva "Buscar en el mercado"; Editar/Borrar solo con permiso. La
  // nota se señala con el icono bajo el kebab (tooltip con su texto).
  return (
    <div className="group relative flex h-full min-h-[3.5rem] rounded-lg border border-ro-panel-border bg-ro-panel-alt transition-colors hover:border-ro-accent">
      {draggable && (
        <span
          aria-hidden
          className="flex shrink-0 cursor-grab items-center justify-center rounded-l-lg border-r border-ro-panel-border px-0.5 text-ro-text-muted/50 transition-colors group-hover:text-ro-text-muted active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="relative flex min-w-0 flex-1 cursor-pointer gap-2 p-2 text-left"
      >
        {iconBox}
        <div className="min-w-0 flex-1">
          <p
            title={title}
            className={`truncate pr-4 text-xs font-bold ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}
          >
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
      </button>

      {/* Kebab para todos los usuarios logueados: "Buscar en el mercado" siempre;
          Editar/Borrar solo con permiso de edición. */}
      <div
        className="absolute right-1 top-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <KebabMenu
          label={t("kebabLabel")}
          items={[
            {
              label: t("searchInMarket"),
              icon: <Search size={14} aria-hidden />,
              onSelect: () => router.push(`/market?${bisEntryMarketQuery(entry)}`),
            },
            ...(canEdit
              ? [
                  { label: t("edit"), icon: <Pencil size={14} aria-hidden />, onSelect: onEdit },
                  { label: t("form.delete"), icon: <Trash2 size={14} aria-hidden />, onSelect: onDelete },
                ]
              : []),
          ]}
        />
      </div>

      {entry.note && (
        <NoteIndicator
          label={entry.note}
          size={13}
          className="absolute grid h-5 w-5 place-items-center"
          // Bajo el kebab (siempre presente). El tooltip muestra el texto de la nota.
          style={{ top: "1.9rem", right: "0.45rem" }}
        />
      )}
    </div>
  );
}

// Vista compacta y NO interactiva de una entrada, para el modal de borrado (que
// se vea qué se elimina). Mismo icono/nombre/options/etiquetas que la card.
function EntryPreview({ entry }: { entry: BisEntryView }) {
  const t = useTranslations("bis");
  const tMarket = useTranslations("market");
  const title = entry.item
    ? formatItemDisplayName(entry.item.name, entry.item.refineLevel, entry.item.cardSlots)
    : entry.weaponType
      ? weaponTypeLabel(tMarket, entry.weaponType)
      : t("anyItem");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt p-2">
      {entry.item ? (
        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-ro-panel-border bg-ro-panel">
          <ItemIcon item={entry.item} width={26} height={26} />
        </div>
      ) : (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-dashed border-ro-panel-border bg-ro-panel text-ro-text-muted">
          <Boxes size={15} aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-bold ${entry.item ? "text-ro-text" : "text-ro-text-muted"}`}>
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
    </div>
  );
}

// Card arrastrable (drag & drop de reordenación). Activación por DISTANCIA
// (ver PointerSensor abajo), así un click sin arrastrar sigue abriendo el
// detalle; arrastrar reordena.
function SortableEntry({
  entry,
  onOpen,
  canEdit,
  onEdit,
  onDelete,
}: {
  entry: BisEntryView;
  onOpen: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: entry.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <EntryCard entry={entry} onOpen={onOpen} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} draggable />
    </li>
  );
}

// Una celda de slot del paperdoll: cabecera (icono + nombre) y sus items. Vacía
// muestra un aviso en gris; si hay más de CELL_LIMIT, un botón las despliega.
function SlotCell({
  def,
  label,
  all,
  shown,
  canEdit,
  sortable,
  onOpen,
  onEditEntry,
  onDeleteEntry,
  onAdd,
  onReorder,
}: {
  def: CellDef;
  label: string;
  all: BisEntryView[];
  shown: BisEntryView[];
  canEdit: boolean;
  // DnD activo: editor, sin filtros y celda de un solo slot (la cabeza combina
  // 3 slots distintos, reordenar entre ellos no tendría sentido).
  sortable: boolean;
  onOpen: (entry: BisEntryView) => void;
  onEditEntry: (entry: BisEntryView) => void;
  onDeleteEntry: (entry: BisEntryView) => void;
  onAdd: () => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const t = useTranslations("bis");
  const [expanded, setExpanded] = useState(false);
  // Dirección del panel flotante: si la celda está pegada abajo (p. ej.
  // accesorio) despliega hacia arriba para no salirse del board.
  const [openUp, setOpenUp] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { Icon } = def;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function openExpanded() {
    const el = sectionRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.top;
      const spaceAbove = rect.bottom;
      setOpenUp(spaceAbove > spaceBelow);
    }
    setExpanded(true);
  }

  // @dnd-kit genera ids (aria-describedby) que no cuadran entre SSR y cliente;
  // se activa solo tras montar para evitar el mismatch de hidratación (en SSR y
  // primer render se pinta la lista plana).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flag de "montado" (tras hidratar) para evitar el mismatch de @dnd-kit; SSR y primer render pintan la lista plana.
    setMounted(true);
  }, []);
  const dndEnabled = sortable && mounted;

  const overLimit = shown.length > CELL_LIMIT;
  const isExpanded = expanded && overLimit;
  const collapsed = shown.slice(0, CELL_LIMIT);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Expandida se reordena sobre toda la lista; colapsada, solo las visibles
    // (las ocultas se reanexan al final para no perder su orden).
    const list = isExpanded ? shown : collapsed;
    const ids = list.map((e) => e.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const hidden = isExpanded ? [] : shown.slice(CELL_LIMIT).map((e) => e.id);
    onReorder([...reordered, ...hidden]);
  }

  const gridClass = "grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2";

  function renderCards(entries: BisEntryView[], interactive: boolean) {
    if (interactive) {
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={rectSortingStrategy}>
            <ul className={gridClass}>
              {entries.map((entry) => (
                <SortableEntry
                  key={entry.id}
                  entry={entry}
                  onOpen={() => onOpen(entry)}
                  canEdit={canEdit}
                  onEdit={() => onEditEntry(entry)}
                  onDelete={() => onDeleteEntry(entry)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      );
    }
    return (
      <ul className={gridClass}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryCard
              entry={entry}
              onOpen={() => onOpen(entry)}
              canEdit={canEdit}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry)}
            />
          </li>
        ))}
      </ul>
    );
  }

  const header = (
    <header className="mb-2 flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ro-accent/10 text-ro-accent">
        <Icon size={16} aria-hidden />
      </span>
      <h3 className="font-heading text-xs tracking-wide text-ro-text">{label}</h3>
      <div className="ml-auto flex items-center gap-1.5">
        {shown.length > 0 && (
          <span className="text-[0.65rem] font-semibold text-ro-text-muted">{shown.length}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={t("add")}
            title={t("add")}
            className="grid h-6 w-6 place-items-center rounded-md border border-ro-panel-border text-ro-text-muted transition-colors hover:border-ro-accent hover:text-ro-accent"
          >
            <Plus size={14} aria-hidden />
          </button>
        )}
      </div>
    </header>
  );

  const toggle = (onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ro-accent hover:underline"
    >
      <ChevronDown size={13} className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
      {isExpanded ? t("showLess") : t("showAll", { count: shown.length })}
    </button>
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex h-full flex-col rounded-xl border border-ro-panel-border bg-ro-panel p-3"
    >
      {header}

      {shown.length === 0 ? (
        <p className="py-1 text-xs italic text-ro-text-muted">
          {all.length === 0 ? t("cell.empty") : t("cell.noMatches")}
        </p>
      ) : (
        <>
          {/* Vista base (colapsada). Al expandir queda como placeholder no
              interactivo detrás del panel flotante, para que la rejilla no
              cambie de alto (las filas son 1fr y se igualan entre sí). */}
          {renderCards(collapsed, dndEnabled && !isExpanded)}
          {overLimit && (
            <button
              type="button"
              onClick={openExpanded}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ro-accent hover:underline"
            >
              <ChevronDown size={13} className="transition-transform" aria-hidden />
              {t("showAll", { count: shown.length })}
            </button>
          )}

          {isExpanded && (
            <>
              {/* Backdrop invisible: cerrar al hacer clic fuera del panel. */}
              <button
                type="button"
                aria-label={t("showLess")}
                onClick={() => setExpanded(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              {/* Panel flotante con la lista completa: se superpone a los slots
                  vecinos en lugar de empujar el layout. Se ancla arriba o abajo
                  según dónde haya más hueco (celdas de abajo despliegan hacia
                  arriba). */}
              <div
                // Insets negativos de 1px: el borde del panel se solapa sobre el
                // de la celda (mismo box) en vez de sumarse por dentro, así el
                // contenido no se desplaza al expandir (el ellipsis no cambia).
                className={`absolute -inset-x-px z-30 flex flex-col rounded-xl border border-ro-accent/50 bg-ro-panel p-3 shadow-2xl ${
                  openUp ? "-bottom-px" : "-top-px"
                }`}
              >
                {header}
                {renderCards(shown, dndEnabled)}
                {toggle(() => setExpanded(false))}
              </div>
            </>
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
  magicalTypes,
  canEdit,
  stageId,
}: {
  entries: BisEntryView[];
  roles: Tag[];
  jobs: Tag[];
  magicalTypes: WeaponType[];
  canEdit: boolean;
  stageId: string;
}) {
  const t = useTranslations("bis");
  const router = useRouter();
  const [, startReorder] = useTransition();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  // Entrada abierta en el detalle (panel/bottom sheet); guarda también el
  // nombre de su celda (slot), que la propia entrada no conoce como texto.
  const [selected, setSelected] = useState<BisDetailData | null>(null);
  // Modal de edición: al crear lleva los slots del cell (cabeza = 3) y entry
  // null; al editar, la entrada y su propio slot.
  const [editing, setEditing] = useState<{ slots: EquipSlot[]; entry: BisEntryView | null } | null>(null);
  // Entrada pendiente de confirmar borrado (kebab → Borrar).
  const [deleting, setDeleting] = useState<BisEntryView | null>(null);
  const [isDeleting, startDelete] = useTransition();

  // Copia local de las entradas para el reorden OPTIMISTA (el DnD mueve al vuelo;
  // el servidor persiste y refresca). Se resetea cuando el server manda datos
  // nuevos (patrón de ajustar estado en render al cambiar la prop).
  const [items, setItems] = useState(entries);
  const [prevEntries, setPrevEntries] = useState(entries);
  if (prevEntries !== entries) {
    setPrevEntries(entries);
    setItems(entries);
  }

  function toggle(current: string | null, next: string, set: (v: string | null) => void) {
    set(current === next ? null : next);
  }

  // Rol y job filtran las cards (AND entre dimensiones). Una entrada casa si
  // lleva ese rol/job entre sus etiquetas.
  const filtered = useMemo(
    () =>
      items.filter(
        (e) =>
          (!activeRole || e.roles.some((r) => r.id === activeRole)) &&
          (!activeJob || e.jobs.some((j) => j.id === activeJob)),
      ),
    [items, activeRole, activeJob],
  );

  const hasFilters = activeRole !== null || activeJob !== null;

  function handleReorder(slot: EquipSlot, orderedIds: string[]) {
    // Optimista: recoloca las entradas de ese slot según el nuevo orden y deja
    // las demás como estaban.
    setItems((prev) => {
      const idSet = new Set(orderedIds);
      const inSlot = orderedIds
        .map((id) => prev.find((e) => e.id === id))
        .filter((e): e is BisEntryView => e !== undefined);
      const others = prev.filter((e) => !idSet.has(e.id));
      return [...inSlot, ...others];
    });
    startReorder(async () => {
      try {
        await reorderBisEntries(stageId, slot, orderedIds);
      } finally {
        // Sincroniza con la verdad del servidor (y revierte si algo falló).
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startDelete(async () => {
      await deleteBisEntry(id);
      setDeleting(null);
      router.refresh();
    });
  }

  function renderCell(def: CellDef) {
    const label = t(`cells.${def.key}`);
    const all = items.filter((e) => def.slots.includes(e.slot));
    const shown = filtered.filter((e) => def.slots.includes(e.slot));
    return (
      <SlotCell
        key={def.key}
        def={def}
        label={label}
        all={all}
        shown={shown}
        canEdit={canEdit}
        sortable={canEdit && !hasFilters && def.slots.length === 1}
        onOpen={(entry) => setSelected({ entry, slotLabel: label, slotIcon: def.Icon })}
        onEditEntry={(entry) => setEditing({ slots: [entry.slot], entry })}
        onDeleteEntry={(entry) => setDeleting(entry)}
        onAdd={() => setEditing({ slots: def.slots, entry: null })}
        onReorder={(orderedIds) => handleReorder(def.slots[0], orderedIds)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterGroup
          legend={t("filters.roleLegend")}
          options={roles}
          activeId={activeRole}
          onToggle={(id) => toggle(activeRole, id, setActiveRole)}
        />
        <FilterGroup
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
            className="inline-flex items-center gap-1 text-xs text-ro-text-muted hover:text-ro-accent"
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

      {selected && (
        <BisDetail
          data={selected}
          canEdit={canEdit}
          onEdit={() => {
            setEditing({ slots: [selected.entry.slot], entry: selected.entry });
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {editing && (
        <BisEntryForm
          key={editing.entry?.id ?? `new-${editing.slots.join("-")}`}
          stageId={stageId}
          slots={editing.slots}
          entry={editing.entry}
          roles={roles}
          jobs={jobs}
          magicalTypes={magicalTypes}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !isDeleting && setDeleting(null)}
        >
          <div
            className="w-full max-w-xs rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-ro-text">{t("deleteConfirm")}</p>
            <div className="mt-3">
              <EntryPreview entry={deleting} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className={`${buttonClass("outline")} h-9`}
              >
                {t("form.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className={`${buttonClass("danger")} h-9`}
              >
                {t("form.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
