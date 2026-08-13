"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, ClipboardCopy, Upload, X, Check } from "lucide-react";
import { buttonClass, inputClass } from "@/lib/ui";
import { encodeBuild, decodeBuild, type Levels } from "@/lib/skill-planner";

// Botones export / import / compartir del planner. Export muestra el código en
// un modal; compartir copia la URL con ?build=; import decodifica un código
// pegado y carga el build (job + niveles).
export function ShareBar({
  jobId,
  levels,
  onImport,
}: {
  jobId: number | null;
  levels: Levels;
  onImport: (jobId: number, levels: Levels) => void;
}) {
  const t = useTranslations("db.skills");
  const [mode, setMode] = useState<null | "export" | "import">(null);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState(false);
  const [copied, setCopied] = useState<null | "code" | "link">(null);

  const code = jobId != null ? encodeBuild(jobId, levels) : "";
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/db/skills?build=${code}` : "";

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }

  function doImport() {
    const decoded = decodeBuild(importCode.trim());
    if (!decoded) {
      setImportError(true);
      return;
    }
    onImport(decoded.jobId, decoded.levels);
    setMode(null);
    setImportCode("");
    setImportError(false);
  }

  const btn = `${buttonClass("outline")} flex h-9 items-center gap-1.5`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImportCode("");
          setImportError(false);
          setMode("import");
        }}
        className={btn}
      >
        <Upload size={14} />
        {t("import")}
      </button>

      {jobId != null && (
        <>
          <button type="button" onClick={() => setMode("export")} className={btn}>
            <ClipboardCopy size={14} />
            {t("export")}
          </button>
          <button type="button" onClick={() => copy(shareUrl, "link")} className={btn}>
            {copied === "link" ? <Check size={14} /> : <Share2 size={14} />}
            {copied === "link" ? t("copied") : t("share")}
          </button>
        </>
      )}

      {mode === "export" && (
        <Modal onClose={() => setMode(null)} label={t("close")} title={t("exportTitle")}>
          <p className="mb-2 text-xs text-ro-text-muted">{t("exportHint")}</p>
          <div className="flex gap-2">
            <input readOnly value={code} className={`${inputClass} h-9 font-mono text-xs`} />
            <button
              type="button"
              onClick={() => copy(code, "code")}
              aria-label={t("copy")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-ro-panel-border hover:border-ro-accent"
            >
              {copied === "code" ? <Check size={16} /> : <ClipboardCopy size={16} />}
            </button>
          </div>
        </Modal>
      )}

      {mode === "import" && (
        <Modal onClose={() => setMode(null)} label={t("close")} title={t("importTitle")}>
          <textarea
            value={importCode}
            onChange={(e) => {
              setImportCode(e.target.value);
              setImportError(false);
            }}
            placeholder={t("importPlaceholder")}
            rows={3}
            className={`${inputClass} font-mono text-xs`}
          />
          {importError && <p className="mt-1 text-xs text-red-700">{t("importError")}</p>}
          <button
            type="button"
            onClick={doImport}
            disabled={importCode.trim() === ""}
            className={`${buttonClass("primary")} mt-3 h-9 w-full disabled:opacity-40`}
          >
            {t("import")}
          </button>
        </Modal>
      )}
    </>
  );
}

function Modal({
  children,
  onClose,
  label,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  title: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-lg border-2 border-ro-panel-border bg-ro-panel p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={label}
          className="absolute right-3 top-3 text-ro-text-muted hover:text-ro-text"
        >
          <X size={18} />
        </button>
        <h3 className="mb-3 pr-6 font-heading text-sm text-ro-text">{title}</h3>
        {children}
      </div>
    </div>
  );
}
