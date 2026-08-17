"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { buttonClass, selectClass } from "@/lib/ui";
import {
  buildCtx,
  buildTrees,
  effLevel,
  getSkill,
  learnCost,
  poolUsage,
  prereqClosure,
  selectableJobs,
  setLevel,
  type Levels,
} from "@/lib/skill-planner";
import { SkillTree } from "./SkillTree";
import { SkillModal } from "./SkillModal";
import { ShareBar } from "./ShareBar";

export function titleCase(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SkillPlanner({
  initialJobId = null,
  initialLevels = {},
}: {
  initialJobId?: number | null;
  initialLevels?: Levels;
}) {
  const t = useTranslations("db.skills");
  const [jobId, setJobId] = useState<number | null>(initialJobId);
  const [levels, setLevels] = useState<Levels>(initialLevels);
  const [modalSkill, setModalSkill] = useState<number | null>(null);
  // Cadena de prereqs a resaltar (la skill en hover + todos sus prereqs).
  const [highlight, setHighlight] = useState<Set<number>>(() => new Set());
  // Coste por skill para aprender la que está en hover (solo si no está
  // aprendida): la propia a 1 + prereqs a su nivel requerido.
  const [needed, setNeeded] = useState<Map<number, number>>(() => new Map());
  // Skill en hover (muestra el TOTAL de puntos en vez de su coste individual).
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);

  const { first, second } = useMemo(() => selectableJobs(), []);
  const ctx = useMemo(() => buildCtx(jobId), [jobId]);
  const trees = useMemo(() => buildTrees(jobId), [jobId]);
  const usage = useMemo(() => poolUsage(levels, ctx), [levels, ctx]);

  function importBuild(newJobId: number, newLevels: Levels) {
    setJobId(newJobId);
    setLevels(newLevels);
    setModalSkill(null);
  }

  function selectJob(value: string) {
    setJobId(value ? Number(value) : null);
    setLevels({});
    setModalSkill(null);
  }

  // Cambia el nivel (sin abrir el modal): lo usan la rueda y los +/- del modal.
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
    // El coste solo se muestra sobre skills NO aprendidas (ni pre).
    const skill = getSkill(id);
    const notLearned = skill != null && !skill.pre && effLevel(id, levels) === 0;
    setNeeded(notLearned ? learnCost(id, ctx, levels) : new Map());
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={jobId ?? ""} onChange={(e) => selectJob(e.target.value)} className={`${selectClass} h-10`}>
          <option value="">{t("chooseJob")}</option>
          <optgroup label={t("firstJobs")}>
            {first.map((j) => (
              <option key={j.id} value={j.id}>
                {titleCase(j.name)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("secondJobs")}>
            {second.map((j) => (
              <option key={j.id} value={j.id}>
                {titleCase(j.name)}
              </option>
            ))}
          </optgroup>
        </select>

        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ro-text-muted">
          <input
            type="checkbox"
            checked={showTooltip}
            onChange={(e) => setShowTooltip(e.target.checked)}
            className="h-4 w-4 accent-ro-accent"
          />
          {t("showTooltip")}
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ShareBar jobId={jobId} levels={levels} onImport={importBuild} />
          {jobId != null && (
            <button
              type="button"
              onClick={() => setLevels({})}
              className={`${buttonClass("outline")} flex h-9 items-center gap-1.5`}
            >
              <RotateCcw size={14} />
              {t("reset")}
            </button>
          )}
        </div>
      </div>

      {jobId == null ? (
        <div className="rounded-lg border-2 border-dashed border-ro-panel-border p-12 text-center text-sm text-ro-text-muted">
          {t("emptyHint")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {trees.map((tree) => {
            const used = tree.tier === "first" ? usage.pool1stUsed : usage.pool2ndUsed;
            const total = tree.tier === "first" ? ctx.P1 : ctx.P2;
            return (
            <div key={tree.job.id} className="rounded-lg border-2 border-ro-panel-border bg-ro-panel/50 p-4">
              <div className="mb-3 flex items-baseline gap-2">
                <h3 className="font-heading text-sm text-ro-text">{titleCase(tree.job.name)}</h3>
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
                  showTooltip={showTooltip}
                  onSelect={setModalSkill}
                  onWheel={wheel}
                  onHover={hover}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}

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

