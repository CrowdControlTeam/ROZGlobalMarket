"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("market.form.screenshot");

  const applyFile = useCallback((next: File) => {
    setFile(next);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
  }, []);

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
  }

  return (
    <div>
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none ${
          isDragOver ? "border-ro-gold bg-ro-gold/10" : "border-ro-panel-border hover:border-ro-gold-dark"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de un blob: URL local, no una imagen remota optimizable
          <img src={previewUrl} alt="Captura seleccionada" className="max-h-40 rounded-md" />
        ) : (
          <>
            <span aria-hidden className="text-xl">
              ⬆
            </span>
            <p className="text-sm font-semibold text-ro-text">{t("upload")}</p>
            <p className="text-xs text-ro-text-muted">{t("hint")}</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} className="hidden" />

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
