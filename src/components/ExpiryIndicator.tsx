"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

// Indicador de caducidad: reloj + tiempo restante (días u horas; "Hoy" en la
// última hora), con la fecha y hora exactas en un tooltip propio (estilado, al
// instante), no el `title` nativo —más sutil—. Se usa en la card del mercado y
// en el detalle. No pinta nada si no hay caducidad o si ya venció (esos listings
// no deberían llegar a mostrarse: la query los oculta).
//
// El tiempo restante se calcula en un efecto (no en el render): Date.now() es
// impuro y no puede llamarse durante el render; además así el primer render
// (servidor e hidratación) coincide —no pinta el texto relativo hasta montar—.
export function ExpiryIndicator({
  expiresAt,
  className = "",
}: {
  expiresAt: string | Date | null;
  className?: string;
}) {
  const t = useTranslations("market.expiry");
  const locale = useLocale();
  const [label, setLabel] = useState<string | null>(null);

  const expires = expiresAt ? (typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt) : null;
  const expiresMs = expires ? expires.getTime() : null;

  useEffect(() => {
    const hourMs = 60 * 60 * 1000;
    const msLeft = expiresMs == null ? -1 : expiresMs - Date.now();
    const next =
      msLeft <= 0
        ? null
        : msLeft >= 24 * hourMs
          ? t("days", { days: Math.floor(msLeft / (24 * hourMs)) })
          : msLeft >= hourMs
            ? t("hours", { hours: Math.ceil(msLeft / hourMs) })
            : t("today");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de Date.now(), solo disponible tras montar (así el primer render coincide con el del servidor)
    setLabel(next);
  }, [expiresMs, t]);

  if (!expires || !label) return null;

  const tooltip = t("tooltip", { date: expires.toLocaleString(locale) });

  return (
    // group + focus-within: el tooltip aparece al pasar el ratón o al enfocar con
    // teclado (tabIndex). aria-label lo anuncia a lectores de pantalla.
    <span
      className={`group relative inline-flex items-center gap-1 ${className}`}
      tabIndex={0}
      aria-label={`${t("clockLabel")}: ${label} — ${tooltip}`}
    >
      <Clock size={12} aria-hidden />
      {label}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-ro-panel-border bg-ro-panel px-2 py-1 text-xs font-normal text-ro-text opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  );
}
