"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  GRID_COLS,
  effLevel,
  getSkill,
  prereqsOf,
  type Levels,
  type PlannerCtx,
  type TreeView,
} from "@/lib/skill-planner";

const CELL = 44;
const GAP = 6;
const STEP = CELL + GAP;

function center(pos: number) {
  return { x: (pos % GRID_COLS) * STEP + CELL / 2, y: Math.floor(pos / GRID_COLS) * STEP + CELL / 2 };
}

// ¿Cumple una skill todos sus prerequisitos (al nivel pedido)?
function prereqsMet(id: number, levels: Levels, ctx: PlannerCtx): boolean {
  return prereqsOf(id, ctx).every((p) => effLevel(p.id, levels) >= p.lv);
}

export function SkillTree({
  tree,
  levels,
  ctx,
  selectedId,
  onSelect,
  onWheel,
}: {
  tree: TreeView;
  levels: Levels;
  ctx: PlannerCtx;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onWheel: (id: number, delta: number) => void;
}) {
  // La rueda cambia el nivel. React registra onWheel como passive, así que
  // preventDefault no frenaría el scroll de página → listener nativo no-pasivo
  // en el contenedor, resolviendo la celda por data-skill-id.
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

  const maxPos = Math.max(0, ...tree.cells.map((c) => c.pos));
  const rows = Math.floor(maxPos / GRID_COLS) + 1;
  const width = GRID_COLS * CELL + (GRID_COLS - 1) * GAP;
  const height = rows * CELL + (rows - 1) * GAP;

  // Posiciones por skillId para trazar las flechas (solo prereqs dentro de este
  // mismo árbol; los cruzados —2nd que pide 1st— quedan en el otro grid, como
  // en las pestañas del juego).
  const posById = new Map(tree.cells.map((c) => [c.id, c.pos]));
  const arrows: { from: number; to: number }[] = [];
  for (const cell of tree.cells) {
    for (const p of prereqsOf(cell.id, ctx)) {
      if (posById.has(p.id)) arrows.push({ from: posById.get(p.id)!, to: cell.pos });
    }
  }

  return (
    <div ref={containerRef} className="relative" style={{ width, height }}>
      <svg
        className="pointer-events-none absolute inset-0"
        width={width}
        height={height}
        aria-hidden
      >
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-ro-accent, #4a90d9)" />
          </marker>
        </defs>
        {arrows.map((a, i) => {
          const from = center(a.from);
          const to = center(a.to);
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-ro-accent, #4a90d9)"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}
      </svg>

      {tree.cells.map((cell) => {
        const skill = getSkill(cell.id);
        if (!skill) return null;
        const { x, y } = center(cell.pos);
        const lv = effLevel(cell.id, levels);
        const met = prereqsMet(cell.id, levels, ctx);
        const learned = lv > 0;
        const unavailable = !skill.pre && lv === 0 && !met;
        const selected = selectedId === cell.id;

        return (
          <button
            key={cell.id}
            type="button"
            title={skill.name}
            data-skill-id={cell.id}
            data-pre={skill.pre ? "1" : "0"}
            onClick={() => onSelect(cell.id)}
            style={{ left: x - CELL / 2, top: y - CELL / 2, width: CELL, height: CELL }}
            className={`absolute flex items-center justify-center rounded-md border-2 bg-ro-panel transition-colors ${
              selected
                ? "border-ro-accent ring-2 ring-ro-accent"
                : skill.pre
                  ? "border-amber-400/70"
                  : learned
                    ? "border-ro-accent"
                    : "border-ro-panel-border hover:border-ro-accent"
            } ${unavailable ? "opacity-40 grayscale" : ""}`}
          >
            <Image
              src={`/icons/skills/${cell.id}.png`}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
            />
            {(learned || skill.pre) && (
              <span
                className={`absolute bottom-0 right-0 rounded-tl rounded-br-[3px] px-1 text-[10px] font-bold leading-tight tabular-nums ${
                  skill.pre ? "bg-amber-500 text-black" : "bg-ro-accent text-white"
                }`}
              >
                {lv}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
