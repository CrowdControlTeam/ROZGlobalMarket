"use client";

import { buildCtx, buildTrees, decodeBuild, poolUsage } from "@/lib/skill-planner";
import { SkillTree } from "./SkillTree";
import { titleCase } from "./SkillPlanner";

const EMPTY_SET: Set<number> = new Set();
const EMPTY_MAP: Map<number, number> = new Map();
const noop = () => {};

// Preview de SOLO LECTURA de un plan de skills (código exportado del planner),
// para el detalle de una build. Decodifica el código y pinta el/los árboles con
// SkillTree en modo readOnly (niveles visibles, sin editar). Si el código no es
// válido, no pinta nada.
export function SkillTreePreview({ code }: { code: string }) {
  const decoded = decodeBuild(code);
  if (!decoded) return null;
  const { jobId, levels } = decoded;
  const ctx = buildCtx(jobId);
  const trees = buildTrees(jobId);
  const usage = poolUsage(levels, ctx);

  return (
    <div className="flex flex-col gap-4">
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
                highlight={EMPTY_SET}
                needed={EMPTY_MAP}
                hoveredId={null}
                showTooltip
                onSelect={noop}
                onWheel={noop}
                onHover={noop}
                readOnly
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
