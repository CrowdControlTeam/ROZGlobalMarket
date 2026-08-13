"use client";

import { useEffect, useRef, useState } from "react";
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
  onSelect,
  onWheel,
  onHover,
}: {
  tree: TreeView;
  levels: Levels;
  ctx: PlannerCtx;
  highlight: Set<number>;
  needed: Map<number, number>;
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

  const maxPos = Math.max(0, ...tree.cells.map((c) => c.pos));
  const rows = Math.floor(maxPos / GRID_COLS) + 1;
  const width = (GRID_COLS - 1) * STEP_X + SLOT_W;
  const height = (rows - 1) * STEP_Y + SLOT_H;

  const hoverSkill = hover != null ? getSkill(hover.id) : undefined;

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
        const need = needed.get(cell.id);

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
                  ? "border-amber-400/70"
                  : learned
                    ? "border-ro-accent"
                    : "border-ro-panel-border group-hover:border-ro-accent"
              } ${highlighted ? "ring-2 ring-ro-accent ring-offset-1 ring-offset-ro-panel" : ""}`}
              style={{ width: BOX, height: BOX }}
            >
              <Image src={`/icons/skills/${cell.id}.png`} alt="" width={ICON} height={ICON} />
              {need != null && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-ro-panel bg-ro-accent px-1 text-[10px] font-bold tabular-nums text-white shadow">
                  {need}
                </span>
              )}
              {(learned || skill.pre) && (
                <span
                  className={`absolute bottom-0 right-0 rounded-tl rounded-br-[3px] px-1 text-[10px] font-bold leading-tight tabular-nums ${
                    skill.pre ? "bg-amber-500 text-black" : "bg-ro-accent text-white"
                  }`}
                >
                  {lv}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {hover && hoverSkill && hoverSkill.desc.length > 0 && (
        <div
          className="pointer-events-none fixed z-50 w-72 max-w-[80vw] rounded-md border-2 border-ro-panel-border bg-ro-panel p-3 shadow-xl"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <RoDescription lines={hoverSkill.desc} format="caret" />
        </div>
      )}
    </div>
  );
}
