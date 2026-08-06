"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, X } from "lucide-react";

// Campo de subida de una imagen que se guarda como data-URI base64 en la
// config (ver branding-constants.ts / admin-config.ts). Lee el archivo en el
// cliente, lo mete como data-URI en un input oculto (para que viaje en el
// FormData del server action) y muestra una vista previa. Vacío = borrar.
export function ImageUploadField({
  name,
  label,
  hint,
  maxBytes,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  maxBytes: number;
  defaultValue?: string | null;
}) {
  const t = useTranslations("admin.appearance");
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > maxBytes) {
      setError(t("tooLarge", { kb: Math.round(maxBytes / 1024) }));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue(typeof reader.result === "string" ? reader.result : "");
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    setValue("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ro-text">{label}</span>
      {hint && <p className="text-xs text-ro-text-muted">{hint}</p>}
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data-URI en memoria, no procede next/image
          <img
            src={value}
            alt=""
            className="h-12 w-auto max-w-[8rem] shrink-0 rounded border border-ro-panel-border bg-ro-panel-alt object-contain"
          />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded border border-ro-panel-border bg-ro-panel-alt text-ro-text-muted">
            <ImageIcon size={18} aria-hidden />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="min-w-0 flex-1 text-sm text-ro-text-muted file:mr-3 file:rounded-md file:border file:border-ro-panel-border file:bg-ro-panel-alt file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ro-text hover:file:bg-ro-panel-border/30"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("remove")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ro-text-muted transition-colors hover:bg-ro-panel-alt hover:text-ro-text"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
