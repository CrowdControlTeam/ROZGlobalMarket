"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, X } from "lucide-react";
import { buttonClass } from "@/lib/ui";
import {
  buildCtx,
  buildTrees,
  decodeBuild,
  effLevel,
  encodeBuild,
  getSkill,
  learnCost,
  poolUsage,
  prereqClosure,
  setLevel,
  type Levels,
} from "@/lib/skill-planner";
import { SkillTree } from "./SkillTree";
import { SkillModal } from "./SkillModal";
import { titleCase } from "./SkillPlanner";

// Planner en modal, FIJADO a la clase de la build (sin selector de job ni
// export/share): se usa desde el editor de builds para configurar el plan de
// skills inline. Parte del código actual (si lo hay y es de esta clase) y al
// guardar devuelve el código nuevo (o null si no se asignó nada).
export function SkillPlannerModal({
  jobId,
  initialCode,
  onSave,
  onClose,
}: {
  jobId: number;
  initialCode: string | null;
  onSave: (code: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("db.skills");
  const [levels, setLevels] = useState<Levels>(() => {
    if (!initialCode) return {};
    const decoded = decodeBuild(initialCode);
    return decoded && decoded.jobId === jobId ? decoded.levels : {};
  });
  const [modalSkill, setModalSkill] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Set<number>>(() => new Set());
  const [needed, setNeeded] = useState<Map<number, number>>(() => new Map());
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const ctx = useMemo(() => buildCtx(jobId), [jobId]);
  const trees = useMemo(() => buildTrees(jobId), [jobId]);
  const usage = poolUsage(levels, ctx);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyLevel(id: number, target: number) {
    const next = setLevel(levels, id, target, ctx);
    if (next) setLevels(next);
  }
  function wheel(id: number, delta: number) {
    applyLevel(id, effLevel(id, levels) + delta);
  }
  function hover(id: number | null) {
    setHoveredId(id);
    if (id == null) {
      setHighlight(new Set());
      setNeeded(new Map());
      return;
    }
    setHighlight(prereqClosure(id, ctx));
    const skill = getSkill(id);
    const notLearned = skill != null && !skill.pre && effLevel(id, levels) === 0;
    setNeeded(notLearned ? learnCost(id, ctx, levels) : new Map());
  }

  function save() {
    // Sin nada asignado → sin plan (null); si no, el código codificado.
    const hasAny = Object.values(levels).some((v) => v > 0);
    onSave(hasAny ? encodeBuild(jobId, levels) : null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-ro-panel-border bg-ro-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ro-panel-border px-4 py-3">
          <h3 className="font-heading text-sm text-ro-text">{t("plannerModalTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-ro-text-muted hover:text-ro-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {trees.map((tree) => {
            const used = ctx.sharedPool != null ? usage.total : tree.tier === "first" ? usage.pool1stUsed : usage.pool2ndUsed;
            const total = ctx.sharedPool != null ? ctx.sharedPool : tree.tier === "first" ? ctx.P1 : ctx.P2;
            return (
              <div key={tree.job.id} className="rounded-lg border-2 border-ro-panel-border bg-ro-panel/50 p-4">
                <div className="mb-3 flex items-baseline gap-2">
                  <h4 className="font-heading text-sm text-ro-text">{titleCase(tree.job.name)}</h4>
                  <span className="text-xs font-semibold text-ro-text-muted">
                    <span className="tabular-nums text-ro-accent">{used}</span> / {total}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <SkillTree
                    tree={tree}
                    levels={levels}
                    ctx={ctx}
                    highlight={highlight}
                    needed={needed}
                    hoveredId={hoveredId}
                    showTooltip
                    onSelect={setModalSkill}
                    onWheel={wheel}
                    onHover={hover}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-ro-panel-border px-4 py-3">
          <button
            type="button"
            onClick={() => setLevels({})}
            className={`${buttonClass("outline")} flex h-9 items-center gap-1.5`}
          >
            <RotateCcw size={14} />
            {t("reset")}
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className={buttonClass("outline")}>
              {t("close")}
            </button>
            <button type="button" onClick={save} className={buttonClass("primary")}>
              {t("applyPlan")}
            </button>
          </div>
        </div>
      </div>

      {modalSkill != null && (
        <SkillModal
          id={modalSkill}
          levels={levels}
          ctx={ctx}
          onChange={applyLevel}
          onClose={() => setModalSkill(null)}
        />
      )}
    </div>
  );
}
