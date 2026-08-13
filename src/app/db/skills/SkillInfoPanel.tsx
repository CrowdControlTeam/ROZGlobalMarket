"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { RoDescription } from "@/components/RoDescription";
import { effLevel, getSkill, prereqsOf, type Levels, type PlannerCtx } from "@/lib/skill-planner";

export function SkillInfoPanel({
  id,
  levels,
  ctx,
  onChange,
}: {
  id: number | null;
  levels: Levels;
  ctx: PlannerCtx;
  onChange: (id: number, target: number) => void;
}) {
  const t = useTranslations("db.skills");
  const skill = id != null ? getSkill(id) : undefined;

  if (!skill || id == null) {
    return (
      <div className="rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 text-center text-sm text-ro-text-muted">
        {t("selectHint")}
      </div>
    );
  }

  const lv = effLevel(id, levels);
  const prereqs = prereqsOf(id, ctx);

  return (
    <div className="rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4">
      <div className="flex items-start gap-3">
        <Image
          src={`/icons/skills/${id}.png`}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded border border-ro-panel-border"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm leading-tight text-ro-text">{skill.name}</h3>
          <p className="mt-0.5 text-xs text-ro-text-muted">{skill.type}</p>
        </div>
      </div>

      {/* Nivel + controles */}
      <div className="mt-3 flex items-center justify-between rounded-md bg-ro-panel-alt/50 px-3 py-2">
        <span className="text-xs text-ro-text-muted">
          {t("level")} <span className="tabular-nums text-ro-text">{lv}</span> / {skill.max}
        </span>
        {skill.pre ? (
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            {t("platinum")}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("decrease")}
              onClick={() => onChange(id, lv - 1)}
              disabled={lv <= 0}
              className="flex h-7 w-7 items-center justify-center rounded border-2 border-ro-panel-border hover:enabled:border-ro-accent disabled:opacity-30"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              aria-label={t("increase")}
              onClick={() => onChange(id, lv + 1)}
              disabled={lv >= skill.max}
              className="flex h-7 w-7 items-center justify-center rounded border-2 border-ro-panel-border hover:enabled:border-ro-accent disabled:opacity-30"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {prereqs.length > 0 && (
        <p className="mt-2 text-xs text-ro-text-muted">
          {t("requires")}:{" "}
          {prereqs
            .map((p) => {
              const ps = getSkill(p.id);
              return `${ps?.name ?? p.id} ${t("lvShort")}${p.lv}`;
            })
            .join(", ")}
        </p>
      )}

      {skill.desc.length > 0 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 p-3">
          <RoDescription lines={skill.desc} format="caret" />
        </div>
      )}
    </div>
  );
}
