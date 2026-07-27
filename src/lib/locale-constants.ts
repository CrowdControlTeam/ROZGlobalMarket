// Catálogo de idiomas soportados por el desplegable de /admin — un valor no
// basta por sí solo, hace falta que exista de verdad el fichero de mensajes
// traducido (messages/<value>.json) y soporte real en el código. Archivo
// aparte (sin imports) para que tanto market-config.ts como el panel de
// admin puedan usarlo sin ciclos — mismo patrón que gemini-model-constants.ts.
export const LOCALE_OPTIONS = [
  {
    value: "es",
    label: "Español",
  },
  {
    value: "en",
    label: "English",
  },
] as const;

export type AppLocale = (typeof LOCALE_OPTIONS)[number]["value"];

export const DEFAULT_LOCALE: AppLocale = LOCALE_OPTIONS[0].value;

const LOCALE_VALUES = LOCALE_OPTIONS.map((o) => o.value);

export function isAppLocale(value: string): value is AppLocale {
  return (LOCALE_VALUES as string[]).includes(value);
}
