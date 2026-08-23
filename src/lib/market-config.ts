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
  accessRoleId: string | null;
  bisEditorRoleId: string | null;
  siteName: string;
};

// Si la fila (id=1) todavía no existe, se cae a los valores conservadores
// por defecto en vez de romper — mismo patrón que loadMaxRefineLevel.
// cache() de React deduplica por request: varias páginas (SiteHeader +
// la propia página + isDmFeatureAvailable, que también la llama) piden
// esta misma fila varias veces en el mismo render — sin esto, cada
// llamada era una query nueva a Postgres.
export const loadMarketConfig = cache(async (): Promise<MarketConfigValues> => {
  // Se seleccionan SOLO los campos escalares. logoUrl/homeImageUrl NO se leen
  // aquí: son data-URI base64 (cientos de KB) y esta función se llama en casi
  // todos los requests (layout, cabecera, guard de /market, acciones…), así que
  // arrastrarlos desangraba la transferencia de datos de Neon. Se leen aparte y
  // solo donde se pintan (ver loadBrandingLogo / loadHomeImage).
  const config = await prisma.marketConfig.findUnique({
    where: { id: 1 },
    select: {
      maxRefineLevel: true,
      webhookUrl: true,
      webhookEnabled: true,
      imageRecognitionEnabled: true,
      geminiModel: true,
      dmNotificationsEnabled: true,
      maintenanceModeEnabled: true,
      optionsEnabled: true,
      adminRoleIds: true,
      accessRoleId: true,
      bisEditorRoleId: true,
      siteName: true,
    },
  });
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
    accessRoleId: config?.accessRoleId ?? null,
    bisEditorRoleId: config?.bisEditorRoleId ?? null,
    siteName: config?.siteName?.trim() || DEFAULT_SITE_NAME,
  };
});

// Imágenes de marca (data-URI base64, cientos de KB). Se leen APARTE de
// loadMarketConfig y SOLO donde se renderizan: el logo en la cabecera (todas
// las páginas) y la imagen del home en el hub (solo `/`). Así no viajan en cada
// request/prefetch que solo necesita la config escalar. cache() las deduplica
// por request igual que loadMarketConfig.
export const loadBrandingLogo = cache(async (): Promise<string | null> => {
  const config = await prisma.marketConfig.findUnique({
    where: { id: 1 },
    select: { logoUrl: true },
  });
  return config?.logoUrl ?? null;
});

export const loadHomeImage = cache(async (): Promise<string | null> => {
  const config = await prisma.marketConfig.findUnique({
    where: { id: 1 },
    select: { homeImageUrl: true },
  });
  return config?.homeImageUrl ?? null;
});
