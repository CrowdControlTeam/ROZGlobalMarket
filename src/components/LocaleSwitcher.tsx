"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_OPTIONS, type AppLocale } from "@/lib/locale-constants";

// Escritura de la cookie a nivel de módulo (fuera del componente) a propósito:
// la regla react-hooks/immutability marca `document.cookie = ...` dentro del
// cuerpo del componente cuando el handler se invoca indirectamente.
function persistLocaleCookie(locale: AppLocale) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
}

// Selector de idioma POR USUARIO. Igual que el tema, la preferencia vive en una
// cookie (NEXT_LOCALE) que el servidor lee para elegir los mensajes (ver
// src/i18n/request.ts). Al elegir, se persiste la cookie y se hace router.refresh
// para que los server components se re-rendericen en el nuevo idioma (el panel de
// usuario sigue abierto y cambia de idioma en vivo). `initial` es el locale ya
// resuelto en servidor, así que no hay parpadeo ni desajuste de hidratación.
export function LocaleSwitcher({ initial }: { initial: AppLocale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<AppLocale>(initial);
  const [isPending, startTransition] = useTransition();

  function select(next: AppLocale) {
    if (next === locale) return;
    setLocale(next);
    persistLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="inline-flex overflow-hidden rounded-md border border-ro-panel-border"
    >
      {LOCALE_OPTIONS.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="button"
            disabled={isPending}
            aria-pressed={active}
            title={o.label}
            onClick={() => select(o.value)}
            className={`px-3 py-1 text-sm uppercase transition-colors disabled:opacity-60 ${
              active
                ? "bg-ro-gold font-semibold text-ro-navy"
                : "text-ro-text-muted hover:bg-white/5"
            }`}
          >
            {o.value}
          </button>
        );
      })}
    </div>
  );
}
