// Aparte de admin-stats.ts (que lleva "use server" y por tanto exige que
// todo lo exportado sea async) porque el desplegable de periodo (cliente)
// necesita esta lista de valores sin pasar por una llamada de red — mismo
// patrón que locale-constants.ts / gemini-model-constants.ts.

// Periodos soportados por el desplegable de estadísticas. El PRIMERO es el
// valor por defecto. Añadir más (p. ej. "todo el tiempo") es solo sumarlos aquí
// + su cálculo en windowStartFor (admin-stats.ts) + su etiqueta i18n.
export const STATS_PERIOD_VALUES = ["7d", "30d"] as const;
export type StatsPeriod = (typeof STATS_PERIOD_VALUES)[number];

export function isStatsPeriod(value: string): value is StatsPeriod {
  return (STATS_PERIOD_VALUES as readonly string[]).includes(value);
}
