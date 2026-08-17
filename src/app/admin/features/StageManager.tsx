"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronUp, ChevronDown, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import {
  createBisStage,
  renameBisStage,
  deleteBisStage,
  reorderBisStages,
} from "@/lib/bis-actions";
import { buttonClass, inputBaseClass } from "@/lib/ui";
import { getErrorMessage } from "@/lib/errors";

type Stage = { id: string; label: string; count: number };

// Módulo BiS de la pestaña Funcionalidades: gestiona las etapas (BisStage).
// Lista ordenada (arriba = mayor order = default en /bis) con crear, renombrar
// inline, reordenar (subir/bajar) y borrar (con confirmación, porque el borrado
// hace cascade sobre sus BiS). El estado real vive en DB; tras cada acción se
// hace router.refresh() para releer el server component.
export function StageManager({ stages }: { stages: Stage[] }) {
  const t = useTranslations("admin.features.bis");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(getErrorMessage(e));
      }
    });
  }

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    setNewLabel("");
    run(() => createBisStage(label));
  }

  function saveRename() {
    if (!editing) return;
    const { id, value } = editing;
    const label = value.trim();
    setEditing(null);
    if (label) run(() => renameBisStage(id, label));
  }

  // Sube/baja una etapa intercambiándola con su vecina y persistiendo el orden
  // completo (arriba a abajo).
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderBisStages(next.map((s) => s.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ro-text-muted">{t("hint")}</p>

      {stages.length === 0 ? (
        <p className="text-sm text-ro-text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stages.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-ro-panel-border bg-ro-panel-alt px-2.5 py-1.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={i === 0 || pending}
                  onClick={() => move(i, -1)}
                  title={t("moveUp")}
                  aria-label={t("moveUp")}
                  className="text-ro-text-muted transition-colors hover:text-ro-text disabled:opacity-25"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === stages.length - 1 || pending}
                  onClick={() => move(i, 1)}
                  title={t("moveDown")}
                  aria-label={t("moveDown")}
                  className="text-ro-text-muted transition-colors hover:text-ro-text disabled:opacity-25"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {editing?.id === s.id ? (
                <input
                  autoFocus
                  value={editing.value}
                  onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    else if (e.key === "Escape") setEditing(null);
                  }}
                  maxLength={60}
                  className={`min-w-0 flex-1 ${inputBaseClass}`}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ro-text">{s.label}</span>
              )}

              <span className="shrink-0 text-xs text-ro-text-muted">{t("entryCount", { count: s.count })}</span>

              {editing?.id === s.id ? (
                <>
                  <button type="button" onClick={saveRename} title={t("save")} aria-label={t("save")} className="text-ro-accent">
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    title={tCommon("cancel")}
                    aria-label={tCommon("cancel")}
                    className="text-ro-text-muted hover:text-ro-text"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : confirmDelete === s.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setConfirmDelete(null);
                      run(() => deleteBisStage(s.id));
                    }}
                    className={`${buttonClass("danger")} px-2 py-1 text-xs`}
                  >
                    {t("confirmDelete", { count: s.count })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    title={tCommon("cancel")}
                    aria-label={tCommon("cancel")}
                    className="text-ro-text-muted hover:text-ro-text"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: s.id, value: s.label })}
                    title={t("rename")}
                    aria-label={t("rename")}
                    className="text-ro-text-muted transition-colors hover:text-ro-text"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(s.id)}
                    title={t("delete")}
                    aria-label={t("delete")}
                    className="text-red-600 transition-colors hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder={t("addPlaceholder")}
          maxLength={60}
          className={`min-w-0 flex-1 ${inputBaseClass}`}
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !newLabel.trim()}
          className={buttonClass("primary")}
        >
          <Plus size={15} aria-hidden />
          {t("add")}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
