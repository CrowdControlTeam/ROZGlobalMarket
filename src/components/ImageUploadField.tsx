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
  onChange,
}: {
  // `name` opcional (ver ToggleSwitch): solo hace falta en forms de servidor.
  name?: string;
  label: string;
  hint?: string;
  maxBytes: number;
  defaultValue?: string | null;
  // Autoguardado: data-URI nuevo, o null al quitar la imagen.
  onChange?: (dataUrl: string | null) => void;
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
      const result = typeof reader.result === "string" ? reader.result : "";
      setValue(result);
      setError(null);
      onChange?.(result || null);
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    setValue("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onChange?.(null);
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
        {/* El input nativo va oculto (su texto "ningún archivo" no se encoge y
            empujaba fuera la ✕): se dispara desde este botón-label. */}
        <label className="shrink-0 cursor-pointer rounded-md border border-ro-panel-border bg-ro-panel-alt px-3 py-1.5 text-sm font-medium text-ro-text transition-colors hover:bg-ro-panel-border/30">
          {value ? t("change") : t("choose")}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ro-panel-border px-2.5 py-1.5 text-sm font-medium text-ro-text-muted transition-colors hover:border-ro-red/50 hover:text-ro-red"
          >
            <X size={15} />
            {t("remove")}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
