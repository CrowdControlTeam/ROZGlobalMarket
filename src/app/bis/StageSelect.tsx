"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { selectClass } from "@/lib/ui";

type Stage = { id: string; key: string; label: string };

// Desplegable de etapa (esquina superior derecha de /bis). Navega al elegir:
// la etapa por defecto (la más reciente) va a /bis limpio; el resto a
// ?stage=<key>, que es lo que lee el server para cargar esa etapa.
export function StageSelect({
  stages,
  selectedKey,
  defaultKey,
}: {
  stages: Stage[];
  selectedKey: string;
  defaultKey: string;
}) {
  const router = useRouter();
  const t = useTranslations("bis");

  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ro-text-muted">
        {t("stageLabel")}
      </span>
      <select
        value={selectedKey}
        onChange={(e) => {
          const key = e.target.value;
          router.push(key === defaultKey ? "/bis" : `/bis?stage=${encodeURIComponent(key)}`);
        }}
        className={selectClass}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
