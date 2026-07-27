// Lista curada de modelos soportados por el desplegable de /admin — no
// cualquier modelo de Gemini, solo los que tiene sentido ofrecer aquí.
// Archivo aparte (sin imports) para que tanto market-config.ts como
// item-recognition.ts y el panel de admin puedan usarlo sin ciclos. Solo
// los valores reales (IDs de la API de Gemini, no traducibles) — el
// label/description que ve el usuario vive en messages/*.json bajo
// admin.recognition.models.<value>, ver getMarketConfig() en admin-config.ts.
export const GEMINI_MODEL_VALUES = ["gemini-flash-latest", "gemini-flash-lite-latest"] as const;

export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number];

export const DEFAULT_GEMINI_MODEL: GeminiModel = GEMINI_MODEL_VALUES[0];

export function isGeminiModel(value: string): value is GeminiModel {
  return (GEMINI_MODEL_VALUES as readonly string[]).includes(value);
}
