"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

// Indicador de caducidad: reloj + tiempo restante (días u horas; "Hoy" en la
// última hora), con la fecha exacta en el tooltip. Se usa en la card del mercado
// y en el detalle. No pinta nada si no hay caducidad o si ya venció (esos
// listings no deberían llegar a mostrarse: la query los oculta).
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

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={t("tooltip", { date: expires.toLocaleString(locale) })}
      aria-label={`${t("clockLabel")}: ${label}`}
    >
      <Clock size={12} aria-hidden />
      {label}
    </span>
  );
}
