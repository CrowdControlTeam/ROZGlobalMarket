"use client";

import "./globals.css";

// error.tsx no cubre fallos en el propio layout.tsx raíz (SiteHeader,
// SiteFooter, el provider de next-intl...) — para eso hace falta este
// archivo aparte, que sustituye TODO el layout mientras está activo
// (por eso define su propio <html>/<body> y reimporta globals.css). Al
// sustituir el layout, también sustituye el <NextIntlClientProvider> que
// vive ahí — useTranslations no tendría contexto del que leer, así que
// este texto se queda fijo en español a propósito (único sitio de toda la
// migración a i18n donde esto aplica).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-ro-bg px-6 text-ro-text">
        <div className="w-full max-w-md rounded-lg border-4 border-ro-panel-border bg-ro-panel p-6 text-center shadow-lg">
          <h1 className="font-heading text-lg text-ro-gold">Algo ha ido mal</h1>
          <p className="mt-2 text-sm text-ro-text-muted">
            Ha ocurrido un error inesperado al cargar la página.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-4 rounded-md border-2 border-ro-gold-dark bg-ro-gold px-4 py-2 text-sm font-semibold text-ro-panel hover:bg-ro-gold-dark"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
