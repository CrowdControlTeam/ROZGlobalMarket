"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { buttonClass, selectClass } from "@/lib/ui";
import {
  buildCtx,
  buildTrees,
  effLevel,
  poolUsage,
  selectableJobs,
  setLevel,
  type Levels,
} from "@/lib/skill-planner";
import { SkillTree } from "./SkillTree";
import { SkillInfoPanel } from "./SkillInfoPanel";

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\d+/g, (n) => n);
}

export function SkillPlanner() {
  const t = useTranslations("db.skills");
  const [jobId, setJobId] = useState<number | null>(null);
  const [levels, setLevels] = useState<Levels>({});
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null);

  const { first, second } = useMemo(() => selectableJobs(), []);
  const ctx = useMemo(() => buildCtx(jobId), [jobId]);
  const trees = useMemo(() => buildTrees(jobId), [jobId]);
  const usage = useMemo(() => poolUsage(levels, ctx), [levels, ctx]);

  function selectJob(value: string) {
    setJobId(value ? Number(value) : null);
    setLevels({});
    setSelectedSkill(null);
  }

  function change(id: number, target: number) {
    setSelectedSkill(id);
    const next = setLevel(levels, id, target, ctx);
    if (next) setLevels(next);
  }

  function wheel(id: number, delta: number) {
    change(id, effLevel(id, levels) + delta);
  }

  return (
    <div>
      {/* Barra superior: job + contadores + reset */}
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

        {jobId != null && (
          <>
            <PoolChip label={t("firstPoints")} used={usage.pool1stUsed} total={ctx.P1} />
            {ctx.P2 > 0 && <PoolChip label={t("secondPoints")} used={usage.pool2ndUsed} total={ctx.P2} />}
            <button
              type="button"
              onClick={() => setLevels({})}
              className={`${buttonClass("outline")} ml-auto flex h-9 items-center gap-1.5`}
            >
              <RotateCcw size={14} />
              {t("reset")}
            </button>
          </>
        )}
      </div>

      {jobId == null ? (
        <div className="rounded-lg border-2 border-dashed border-ro-panel-border p-12 text-center text-sm text-ro-text-muted">
          {t("emptyHint")}
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-col gap-4">
            {trees.map((tree) => (
              <div key={tree.job.id} className="rounded-lg border-2 border-ro-panel-border bg-ro-panel/50 p-4">
                <h3 className="mb-3 font-heading text-sm text-ro-text">{titleCase(tree.job.name)}</h3>
                <div className="overflow-x-auto">
                  <SkillTree
                    tree={tree}
                    levels={levels}
                    ctx={ctx}
                    selectedId={selectedSkill}
                    onSelect={setSelectedSkill}
                    onWheel={wheel}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="lg:w-72 lg:shrink-0">
            <div className="lg:sticky lg:top-4">
              <SkillInfoPanel id={selectedSkill} levels={levels} ctx={ctx} onChange={change} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Muestra puntos ASIGNADOS (empieza en 0 y sube conforme se reparten).
function PoolChip({ label, used, total }: { label: string; used: number; total: number }) {
  return (
    <span className="rounded-md border-2 border-ro-panel-border bg-ro-panel px-3 py-1.5 text-xs font-semibold text-ro-text">
      {label}: <span className="tabular-nums text-ro-accent">{used}</span>
      <span className="text-ro-text-muted"> / {total}</span>
    </span>
  );
}
