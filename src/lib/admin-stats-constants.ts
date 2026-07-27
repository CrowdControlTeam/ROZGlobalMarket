// Aparte de admin-stats.ts (que lleva "use server" y por tanto exige que
// todo lo exportado sea async) porque el desplegable de periodo (cliente)
// necesita esta lista de valores sin pasar por una llamada de red — mismo
// patrón que locale-constants.ts / gemini-model-constants.ts.

// Único valor soportado por ahora — el desplegable ya existe en la UI para
// poder añadir más periodos ("todo el tiempo", "7 días"...) más adelante
// sin rehacer nada, pero de momento solo se calcula este.
export const STATS_PERIOD_VALUES = ["30d"] as const;
export type StatsPeriod = (typeof STATS_PERIOD_VALUES)[number];

export function isStatsPeriod(value: string): value is StatsPeriod {
  return (STATS_PERIOD_VALUES as readonly string[]).includes(value);
}
