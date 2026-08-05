"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { ImageUp } from "lucide-react";
import { buttonClass } from "@/lib/ui";
import { MAX_SCREENSHOT_BYTES, MAX_SCREENSHOT_MB } from "@/lib/screenshot-constants";

// Zona de arrastrar/pegar/clic para subir la captura del tooltip, en vez de
// un <input type="file"> nativo — inspirado en el flujo de diablo.trade que
// pidió el usuario: se sube y previsualiza la imagen primero, y el escaneo
// (la llamada a Gemini) se dispara aparte con un botón, no automáticamente.
export function ScreenshotDropzone({
  onScan,
  isScanning,
}: {
  onScan: (file: File) => void;
  isScanning: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("market.form.screenshot");

  const applyFile = useCallback(
    (next: File) => {
      // Se rechaza aquí antes de subir nada (el servidor lo revalida igual,
      // ver recognizeItemFromScreenshot) para dar feedback inmediato.
      if (next.size > MAX_SCREENSHOT_BYTES) {
        setError(t("tooLarge", { max: MAX_SCREENSHOT_MB }));
        return;
      }
      setError(null);
      setFile(next);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(next);
      });
    },
    [t],
  );

  // Pegar (Ctrl+V) se escucha a nivel de window, no en el propio div: hacer
  // clic en la zona abre el diálogo nativo de archivos, que al cerrarse no
  // devuelve el foco de forma fiable al div, así que un onPaste ahí se queda
  // sin disparar la mayoría de las veces.
  useEffect(() => {
    function handleWindowPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const pasted = item?.getAsFile();
      if (pasted) applyFile(pasted);
    }
    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [applyFile]);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("image/")) applyFile(dropped);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (picked) applyFile(picked);
  }

  function handleClear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-40 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed p-4 text-center transition-colors focus:outline-none ${
          isDragOver ? "border-ro-accent bg-ro-accent/15" : "border-ro-accent/60 bg-ro-accent/[0.06] hover:border-ro-accent"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de un blob: URL local, no una imagen remota optimizable
          <img src={previewUrl} alt="Captura seleccionada" className="max-h-40 rounded-lg" />
        ) : (
          <>
            <span aria-hidden className="grid h-11 w-11 place-items-center rounded-lg bg-ro-accent/15 text-ro-accent">
              <ImageUp size={22} />
            </span>
            <p className="text-sm font-semibold text-ro-text">{t("upload")}</p>
            <p className="max-w-[22ch] text-xs text-ro-text-muted">{t("hint")}</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} className="hidden" />

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {file && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleClear} disabled={isScanning} className={buttonClass("outline")}>
            {t("clear")}
          </button>
          <button type="button" onClick={() => onScan(file)} disabled={isScanning} className={buttonClass("primary")}>
            {isScanning ? t("scanning") : t("scan")}
          </button>
        </div>
      )}
    </div>
  );
}
