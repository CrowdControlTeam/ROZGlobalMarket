"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/Panel";
import { buttonClass } from "@/lib/ui";

// Boundary raíz: envuelve todas las páginas/layouts por debajo de este
// (NO el propio layout.tsx — para eso hace falta global-error.tsx aparte).
// Sin este archivo, cualquier fallo no controlado en un Server Component
// (ej. la base de datos no responde) mostraba la pantalla genérica de
// Next ("Application error...") sin ningún mensaje útil para el usuario.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors.boundary");
  const tButton = useTranslations("market.button");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <Panel>
        <h1 className="font-heading text-lg text-ro-gold">{t("title")}</h1>
        <p className="mt-2 text-sm text-ro-text-muted">{t("message")}</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={`mt-4 ${buttonClass("secondary")}`}
        >
          {tButton("retry")}
        </button>
      </Panel>
    </main>
  );
}
