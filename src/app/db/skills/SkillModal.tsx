"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Minus, Plus, X } from "lucide-react";
import { RoDescription } from "@/components/RoDescription";
import { effLevel, getSkill, prereqsOf, type Levels, type PlannerCtx } from "@/lib/skill-planner";

// Detalle de una skill en modal (al hacer click). Cierra con la X, click en el
// fondo o Escape. Los +/- cambian el nivel (con la misma lógica de cascada).
export function SkillModal({
  id,
  levels,
  ctx,
  onChange,
  onClose,
}: {
  id: number;
  levels: Levels;
  ctx: PlannerCtx;
  onChange: (id: number, target: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("db.skills");
  const skill = getSkill(id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!skill) return null;
  const lv = effLevel(id, levels);
  const prereqs = prereqsOf(id, ctx);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 text-ro-text-muted hover:text-ro-text"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 pr-6">
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
            {prereqs.map((p) => `${getSkill(p.id)?.name ?? p.id} ${t("lvShort")}${p.lv}`).join(", ")}
          </p>
        )}

        {skill.desc.length > 0 && (
          <div className="mt-3 rounded-md border border-ro-panel-border/60 bg-ro-panel-alt/40 p-3">
            <RoDescription lines={skill.desc} format="caret" />
          </div>
        )}
      </div>
    </div>
  );
}
