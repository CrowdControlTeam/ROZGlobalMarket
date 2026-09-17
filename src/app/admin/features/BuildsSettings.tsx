"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, Loader2 } from "lucide-react";
import { setMarketConfigField } from "@/lib/admin-config";
import { FloatingField, floatingControlClass, floatingSelectClass } from "@/components/FloatingField";
import { getErrorMessage } from "@/lib/errors";

type Role = { id: string; name: string };

// Ajustes de la feature "builds" (pestaña Funcionalidades): tope por usuario y un
// OVERRIDE opcional para un rol concreto (los usuarios con ese rol usan otro
// tope). Autoguardado por campo con ✓/X, mismo criterio que el resto de admin.
export function BuildsSettings({
  maxBuildsPerUser,
  buildsRoleId,
  buildsRoleMax,
  roles,
}: {
  maxBuildsPerUser: number;
  buildsRoleId: string | null;
  buildsRoleMax: number | null;
  roles: Role[] | null;
}) {
  const t = useTranslations("admin.features.builds");

  return (
    <div className="flex flex-col gap-5">
      <NumberField
        label={t("maxBuildsLabel")}
        hint={t("maxBuildsHint")}
        initial={maxBuildsPerUser}
        min={1}
        commit={(v) => setMarketConfigField({ field: "maxBuildsPerUser", value: v! })}
      />

      <div className="border-t border-ro-panel-border pt-4">
        <RoleField
          label={t("roleLabel")}
          hint={t("roleHint")}
          noneLabel={t("roleNone")}
          value={buildsRoleId}
          roles={roles}
        />
      </div>

      <NumberField
        label={t("roleMaxLabel")}
        hint={t("roleMaxHint")}
        initial={buildsRoleMax}
        min={1}
        nullable
        commit={(v) => setMarketConfigField({ field: "buildsRoleMax", value: v })}
      />
    </div>
  );
}

// Campo numérico con autoguardado (✓/X). `nullable`: permite vaciar → guarda null.
function NumberField({
  label,
  hint,
  initial,
  min,
  nullable,
  commit,
}: {
  label: string;
  hint: string;
  initial: number | null;
  min: number;
  nullable?: boolean;
  commit: (value: number | null) => Promise<void>;
}) {
  const tCommon = useTranslations("common");
  const tButton = useTranslations("market.button");
  const initialStr = initial == null ? "" : String(initial);
  const [saved, setSaved] = useState(initialStr);
  const [value, setValue] = useState(initialStr);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== saved;

  async function doCommit() {
    if (!dirty) return;
    const trimmed = value.trim();
    if (trimmed === "" && !nullable) {
      setValue(saved);
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      await commit(trimmed === "" ? null : Number(trimmed));
      setSaved(value);
      setStatus("done");
      window.setTimeout(() => setStatus((s) => (s === "done" ? "idle" : s)), 1600);
    } catch (err) {
      setStatus("idle");
      setError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <FloatingField label={label}>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doCommit();
              else if (e.key === "Escape") setValue(saved);
            }}
            className={`min-w-0 flex-1 ${floatingControlClass}`}
          />
          {dirty ? (
            <>
              <button type="button" onClick={doCommit} title={tButton("save")} aria-label={tButton("save")} className="text-ro-accent">
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => setValue(saved)}
                title={tCommon("cancel")}
                aria-label={tCommon("cancel")}
                className="text-ro-text-muted transition-colors hover:text-ro-text"
              >
                <X size={16} />
              </button>
            </>
          ) : status === "saving" ? (
            <Loader2 size={16} className="animate-spin text-ro-text-muted" />
          ) : status === "done" ? (
            <Check size={16} className="text-green-600" />
          ) : null}
        </div>
      </FloatingField>
      <p className="mt-1 text-xs text-ro-text-muted">{hint}</p>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

// Selector de rol único: <select> si hay roles del bot, o input de texto (ID)
// si no. Autoguarda al cambiar/confirmar. Vacío = sin override.
function RoleField({
  label,
  hint,
  noneLabel,
  value,
  roles,
}: {
  label: string;
  hint: string;
  noneLabel: string;
  value: string | null;
  roles: Role[] | null;
}) {
  const tButton = useTranslations("market.button");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(value ?? "");

  async function save(roleId: string) {
    setError(null);
    setStatus("saving");
    try {
      await setMarketConfigField({ field: "buildsRoleId", value: roleId });
      setStatus("done");
      window.setTimeout(() => setStatus((s) => (s === "done" ? "idle" : s)), 1600);
    } catch (err) {
      setStatus("idle");
      setError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <FloatingField label={label}>
        <div className="flex items-center gap-2">
          {roles ? (
            <select
              defaultValue={value ?? ""}
              onChange={(e) => save(e.target.value)}
              className={`min-w-0 flex-1 ${floatingSelectClass}`}
            >
              <option value="">{noneLabel}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(text.trim());
                }}
                placeholder="123456789012345678"
                className={`min-w-0 flex-1 ${floatingControlClass}`}
              />
              <button
                type="button"
                onClick={() => save(text.trim())}
                title={tButton("save")}
                aria-label={tButton("save")}
                className="text-ro-accent"
              >
                <Check size={16} />
              </button>
            </>
          )}
          {status === "saving" ? (
            <Loader2 size={16} className="animate-spin text-ro-text-muted" />
          ) : status === "done" ? (
            <Check size={16} className="text-green-600" />
          ) : null}
        </div>
      </FloatingField>
      <p className="mt-1 text-xs text-ro-text-muted">{hint}</p>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
