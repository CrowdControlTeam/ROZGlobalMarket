"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, Loader2 } from "lucide-react";
import { setMarketConfigField } from "@/lib/admin-config";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import { getErrorMessage } from "@/lib/errors";

// Ajustes de la feature "builds" (pestaña Funcionalidades). De momento solo el
// tope de builds por usuario. Autoguardado por campo con ✓/X, mismo criterio
// que el formulario general de admin.
export function BuildsSettings({ maxBuildsPerUser }: { maxBuildsPerUser: number }) {
  const t = useTranslations("admin.features.builds");
  const tCommon = useTranslations("common");
  const tButton = useTranslations("market.button");

  const initial = String(maxBuildsPerUser);
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== saved;

  async function commit() {
    if (!dirty) return;
    setError(null);
    setStatus("saving");
    try {
      await setMarketConfigField({ field: "maxBuildsPerUser", value: Number(value) });
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
      <FloatingField label={t("maxBuildsLabel")}>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") setValue(saved);
            }}
            className={`min-w-0 flex-1 ${floatingControlClass}`}
          />
          {dirty ? (
            <>
              <button type="button" onClick={commit} title={tButton("save")} aria-label={tButton("save")} className="text-ro-accent">
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
      <p className="mt-1 text-xs text-ro-text-muted">{t("maxBuildsHint")}</p>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
