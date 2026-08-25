// Lector interno de MarketConfig, sin "use server": a diferencia de
// src/lib/admin-config.ts (que sí expone server actions llamables desde
// cliente), este módulo nunca debe ser invocable directamente desde el
// navegador — devuelve valores en crudo (incluida la URL real del webhook),
// así que solo lo importan otros módulos server-only (discord-webhook.ts,
// listings.ts, item-recognition.ts, páginas server component).
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

// Cache en memoria POR ISOLATE. En Cloudflare Workers el scope del módulo
// sobrevive entre requests del mismo isolate, así que memoizamos las lecturas de
// config con un TTL corto: la fila cambia rarísimo (edición admin) pero se lee en
// casi cada request → la mayoría ya no tocan la DB. Recorta el egress de Neon y
// deja dormir más al compute. Dedup por request incluido (una lectura en vuelo se
// comparte), así que sustituye al cache() de React. TTL corto para que los
// cambios de admin (mantenimiento, roles) se propaguen pronto; además se invalida
// al guardar (bustConfigCache).
const CONFIG_TTL_MS = 30_000;

type Memoized<T> = (() => Promise<T>) & { bust: () => void };

function ttlMemo<T>(fn: () => Promise<T>, ttlMs: number): Memoized<T> {
  let cell: { value: T; expires: number } | null = null;
  let inflight: Promise<T> | null = null;
  async function get(): Promise<T> {
    if (cell && cell.expires > Date.now()) return cell.value;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const value = await fn();
        cell = { value, expires: Date.now() + ttlMs };
        return value;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }
  const memoized = get as Memoized<T>;
  memoized.bust = () => {
    cell = null;
  };
  return memoized;
}

// Si la fila (id=1) todavía no existe, se cae a los valores conservadores por
// defecto en vez de romper. Solo campos escalares (logoUrl/homeImageUrl van
// aparte, ver más abajo).
export const loadMarketConfig = ttlMemo(async (): Promise<MarketConfigValues> => {
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
}, CONFIG_TTL_MS);

// Imágenes de marca (data-URI base64, cientos de KB). Se leen APARTE de
// loadMarketConfig y SOLO donde se renderizan: el logo en la cabecera (todas
// las páginas) y la imagen del home en el hub (solo `/`). Mismo cache en memoria
// con TTL para no re-leerlas de la DB en cada render.
export const loadBrandingLogo = ttlMemo(async (): Promise<string | null> => {
  const config = await prisma.marketConfig.findUnique({
    where: { id: 1 },
    select: { logoUrl: true },
  });
  return config?.logoUrl ?? null;
}, CONFIG_TTL_MS);

export const loadHomeImage = ttlMemo(async (): Promise<string | null> => {
  const config = await prisma.marketConfig.findUnique({
    where: { id: 1 },
    select: { homeImageUrl: true },
  });
  return config?.homeImageUrl ?? null;
}, CONFIG_TTL_MS);

// Invalida el cache en memoria tras un cambio en /admin (ver setMarketConfigField).
// Solo afecta al isolate que atiende el guardado; el resto se pone al día en <=TTL.
export function bustConfigCache() {
  loadMarketConfig.bust();
  loadBrandingLogo.bust();
  loadHomeImage.bust();
}
