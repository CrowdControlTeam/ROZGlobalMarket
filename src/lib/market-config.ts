// Lector interno de MarketConfig, sin "use server": a diferencia de
// src/lib/admin-config.ts (que sí expone server actions llamables desde
// cliente), este módulo nunca debe ser invocable directamente desde el
// navegador — devuelve valores en crudo (incluida la URL real del webhook),
// así que solo lo importan otros módulos server-only (discord-webhook.ts,
// listings.ts, item-recognition.ts, páginas server component).
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_REFINE_LEVEL } from "@/lib/refine-constants";
import { DEFAULT_GEMINI_MODEL, isGeminiModel, type GeminiModel } from "@/lib/gemini-model-constants";

// Placeholder/fallback hasta que se configure — vive en código a
// propósito, no en el default de la columna (ver comentario en
// schema.prisma), para distinguir "sin configurar" de "configurado
// literalmente a este valor".
export const DEFAULT_SITE_NAME = "ROZ Global Market";

export type MarketConfigValues = {
  maxRefineLevel: number;
  webhookUrl: string | null;
  webhookEnabled: boolean;
  imageRecognitionEnabled: boolean;
  geminiModel: GeminiModel;
  dmNotificationsEnabled: boolean;
  maintenanceModeEnabled: boolean;
  optionsEnabled: boolean;
  adminRoleIds: string[];
  siteName: string;
};

// Si la fila (id=1) todavía no existe, se cae a los valores conservadores
// por defecto en vez de romper — mismo patrón que loadMaxRefineLevel.
// cache() de React deduplica por request: varias páginas (SiteHeader +
// la propia página + isDmFeatureAvailable, que también la llama) piden
// esta misma fila varias veces en el mismo render — sin esto, cada
// llamada era una query nueva a Postgres.
export const loadMarketConfig = cache(async (): Promise<MarketConfigValues> => {
  const config = await prisma.marketConfig.findUnique({ where: { id: 1 } });
  return {
    maxRefineLevel: config?.maxRefineLevel ?? DEFAULT_MAX_REFINE_LEVEL,
    webhookUrl: config?.webhookUrl ?? null,
    webhookEnabled: config?.webhookEnabled ?? false,
    imageRecognitionEnabled: config?.imageRecognitionEnabled ?? false,
    // Por si el valor guardado dejara de ser una opción soportada (se quita
    // del desplegable más adelante) — se cae al default en vez de mandarle
    // a Gemini un modelo que ya no ofrecemos.
    geminiModel: config?.geminiModel && isGeminiModel(config.geminiModel) ? config.geminiModel : DEFAULT_GEMINI_MODEL,
    dmNotificationsEnabled: config?.dmNotificationsEnabled ?? true,
    maintenanceModeEnabled: config?.maintenanceModeEnabled ?? false,
    optionsEnabled: config?.optionsEnabled ?? true,
    adminRoleIds: config?.adminRoleIds ?? [],
    siteName: config?.siteName?.trim() || DEFAULT_SITE_NAME,
  };
});
