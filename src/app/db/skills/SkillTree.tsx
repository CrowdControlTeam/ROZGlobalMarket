"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { RoDescription } from "@/components/RoDescription";
import {
  GRID_COLS,
  effLevel,
  getSkill,
  prereqsOf,
  type Levels,
  type PlannerCtx,
  type TreeView,
} from "@/lib/skill-planner";

// Geometría del slot: caption (nombre, a modo de título) ARRIBA con altura fija
// + caja del icono debajo, con separación holgada entre slots. La altura fija
// del caption mantiene el icono a una Y constante (para trazar bien las flechas).
const BOX = 46; // caja del icono (con borde)
const ICON = 36;
const CAPTION_H = 26; // hasta 2 líneas de nombre
const SLOT_W = 84; // ancho del slot (deja sitio al nombre)
const SLOT_H = CAPTION_H + 2 + BOX;
const STEP_X = SLOT_W + 12;
const STEP_Y = SLOT_H + 16;

function slotPos(pos: number) {
  return { x: (pos % GRID_COLS) * STEP_X, y: Math.floor(pos / GRID_COLS) * STEP_Y };
}

function prereqsMet(id: number, levels: Levels, ctx: PlannerCtx): boolean {
  return prereqsOf(id, ctx).every((p) => effLevel(p.id, levels) >= p.lv);
}

export function SkillTree({
  tree,
  levels,
  ctx,
  highlight,
  needed,
  hoveredId,
  showTooltip,
  onSelect,
  onWheel,
  onHover,
}: {
  tree: TreeView;
  levels: Levels;
  ctx: PlannerCtx;
  highlight: Set<number>;
  needed: Map<number, number>;
  hoveredId: number | null;
  showTooltip: boolean;
  onSelect: (id: number) => void;
  onWheel: (id: number, delta: number) => void;
  onHover: (id: number | null) => void;
}) {
  // Rueda: listener nativo no-pasivo (React lo registra passive → preventDefault
  // no frenaría el scroll de página). Resuelve la celda por data-skill-id.
  const onWheelRef = useRef(onWheel);
  useEffect(() => {
    onWheelRef.current = onWheel;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handler(e: WheelEvent) {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-skill-id]");
      if (!target || target.dataset.pre === "1") return;
      e.preventDefault();
      onWheelRef.current(Number(target.dataset.skillId), e.deltaY < 0 ? 1 : -1);
    }
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);

  // Posición del tooltip acotada al viewport: por defecto junto al cursor
  // (x+14, y+14) y, si se saliera por la derecha/abajo, se voltea al otro lado
  // (y se fija a un margen mínimo si aun así no cupiera, para que se vea el
  // inicio de la descripción). Mismo criterio que PreviewShell. Se mide en un
  // layout effect (antes de pintar) para no ver un salto de posición.
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    // setState va dentro de una función (no directo en el cuerpo del efecto),
    // mismo patrón que PreviewShell. Al cambiar hover a null el tooltip se
    // desmonta, así que no hace falta resetear tipPos.
    function reposition() {
      const node = tipRef.current;
      if (!hover || !node) return;
      const r = node.getBoundingClientRect();
      const pad = 8;
      let left = hover.x + 14;
      let top = hover.y + 14;
      if (left + r.width > window.innerWidth - pad) left = Math.max(pad, hover.x - r.width - 14);
      if (top + r.height > window.innerHeight - pad) top = Math.max(pad, hover.y - r.height - 14);
      setTipPos({ left, top });
    }
    reposition();
  }, [hover]);

  const maxPos = Math.max(0, ...tree.cells.map((c) => c.pos));
  const rows = Math.floor(maxPos / GRID_COLS) + 1;
  const width = (GRID_COLS - 1) * STEP_X + SLOT_W;
  const height = (rows - 1) * STEP_Y + SLOT_H;

  const hoverSkill = hover != null ? getSkill(hover.id) : undefined;
  // Total de puntos de la cadena (se muestra sobre la skill en hover).
  let neededTotal = 0;
  for (const v of needed.values()) neededTotal += v;

  return (
    <div ref={containerRef} className="relative" style={{ width, height }}>
      {tree.cells.map((cell) => {
        const skill = getSkill(cell.id);
        if (!skill) return null;
        const s = slotPos(cell.pos);
        const lv = effLevel(cell.id, levels);
        const learned = lv > 0;
        const unavailable = !skill.pre && lv === 0 && !prereqsMet(cell.id, levels, ctx);
        const highlighted = highlight.has(cell.id);
        // La skill en hover muestra el TOTAL de la cadena; los prereqs, su coste.
        const rawNeed = needed.get(cell.id);
        const need = rawNeed == null ? null : cell.id === hoveredId ? neededTotal : rawNeed;

        return (
          <button
            key={cell.id}
            type="button"
            title={skill.name}
            data-skill-id={cell.id}
            data-pre={skill.pre ? "1" : "0"}
            onClick={() => onSelect(cell.id)}
            onMouseEnter={(e) => {
              setHover({ id: cell.id, x: e.clientX, y: e.clientY });
              onHover(cell.id);
            }}
            onMouseMove={(e) => setHover({ id: cell.id, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => {
              setHover((h) => (h?.id === cell.id ? null : h));
              onHover(null);
            }}
            style={{ left: s.x, top: s.y, width: SLOT_W, height: SLOT_H }}
            className={`group absolute flex flex-col items-center ${
              unavailable && !highlighted ? "opacity-40 grayscale" : ""
            }`}
          >
            <span
              className="flex w-full items-end justify-center"
              style={{ height: CAPTION_H }}
            >
              <span
                className={`line-clamp-2 px-0.5 text-center text-[9px] leading-tight ${
                  learned ? "text-ro-text" : "text-ro-text-muted"
                }`}
              >
                {skill.name}
              </span>
            </span>
            <span
              className={`relative mt-0.5 flex items-center justify-center rounded-md border-2 bg-ro-panel transition-all ${
                skill.pre
                  ? "border-violet-400/70"
                  : learned
                    ? "border-ro-accent"
                    : "border-ro-panel-border group-hover:border-ro-accent"
              } ${highlighted ? "ring-2 ring-ro-accent ring-offset-1 ring-offset-ro-panel" : ""}`}
              style={{ width: BOX, height: BOX }}
            >
              <Image src={`/icons/skills/${cell.id}.png`} alt="" width={ICON} height={ICON} />
              {need != null && (
                <span
                  className={`absolute -right-2 -top-2 flex items-center justify-center rounded-full border border-ro-panel bg-ro-accent px-1 font-bold tabular-nums text-white shadow ${
                    cell.id === hoveredId
                      ? "h-6 min-w-6 text-[11px] ring-2 ring-ro-accent/40"
                      : "h-5 min-w-5 text-[10px]"
                  }`}
                >
                  {need}
                </span>
              )}
              {(learned || skill.pre) && (
                <span
                  className={`absolute bottom-0 right-0 rounded-tl rounded-br-[3px] px-1 text-[10px] font-bold leading-tight tabular-nums ${
                    skill.pre ? "bg-violet-500 text-white" : "bg-ro-accent text-white"
                  }`}
                >
                  {lv}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {showTooltip && hover && hoverSkill && hoverSkill.desc.length > 0 && (
        <div
          ref={tipRef}
          className="pointer-events-none fixed z-50 max-h-[calc(100vh-1rem)] w-72 max-w-[80vw] overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel p-3 shadow-xl"
          style={{ left: (tipPos ?? { left: hover.x + 14 }).left, top: (tipPos ?? { top: hover.y + 14 }).top }}
        >
          <RoDescription lines={hoverSkill.desc} />
        </div>
      )}
    </div>
  );
}
