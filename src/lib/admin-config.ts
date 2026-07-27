"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { loadMarketConfig } from "@/lib/market-config";
import { getOptionsCatalogCount } from "@/lib/item-options";
import { fetchGuildRoles } from "@/lib/discord-bot";
import { GEMINI_MODEL_VALUES, isGeminiModel } from "@/lib/gemini-model-constants";
import { LOCALE_OPTIONS, isAppLocale } from "@/lib/locale-constants";
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-constants";

// El valor real de un secreto nunca sale del servidor una vez guardado —
// esto es lo único que llega al cliente para representarlo en el formulario.
function maskSecret(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function getMarketConfig() {
  await requireAdmin();

  const [config, optionsCatalogCount, guildRolesResult, rawConfig, t] = await Promise.all([
    loadMarketConfig(),
    getOptionsCatalogCount(),
    fetchGuildRoles(),
    prisma.marketConfig.findUnique({ where: { id: 1 }, select: { siteName: true } }),
    getTranslations("admin.recognition.models"),
  ]);

  const geminiModelOptions = GEMINI_MODEL_VALUES.map((value) => ({
    value,
    label: t(`${value}.label`),
    description: t(`${value}.description`),
  }));

  return {
    // Valor sin resolver (puede ser null) para que el campo del formulario
    // arranque vacío con el placeholder hasta que se configure la primera
    // vez, en vez de aparentar que "ROZ Global Market" ya se guardó a mano.
    siteName: rawConfig?.siteName ?? "",
    siteNamePlaceholder: config.siteName,
    maxRefineLevel: config.maxRefineLevel,
    webhookEnabled: config.webhookEnabled,
    webhookUrlMasked: config.webhookUrl ? maskSecret(config.webhookUrl) : null,
    imageRecognitionEnabled: config.imageRecognitionEnabled,
    hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
    geminiModel: config.geminiModel,
    geminiModelOptions,
    dmNotificationsEnabled: config.dmNotificationsEnabled,
    hasDiscordBotToken: !!process.env.DISCORD_BOT_TOKEN,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    optionsEnabled: config.optionsEnabled,
    optionsCatalogCount,
    adminRoleIds: config.adminRoleIds,
    guildRolesResult,
    locale: config.locale,
    localeOptions: LOCALE_OPTIONS,
  };
}

// IDs de rol de Discord (snowflakes): solo dígitos. Se filtra en vez de
// rechazar todo el formulario por una línea mal pegada — es una lista de
// texto libre en el caso sin bot, conviene ser tolerante.
const SNOWFLAKE = /^\d{15,25}$/;


function parseAdminRoleIds(formData: FormData): string[] {
  // Modo con bot: <select multiple name="adminRoleIds"> manda varias
  // entradas con el mismo nombre. Modo sin bot: un único textarea con un
  // ID por línea/coma. Solo uno de los dos se renderiza a la vez, así que
  // no hay ambigüedad sobre cuál usar.
  const textarea = formData.get("adminRoleIdsText");
  const raw =
    typeof textarea === "string"
      ? textarea.split(/[\n,]/)
      : formData.getAll("adminRoleIds").filter((v): v is string => typeof v === "string");

  return Array.from(new Set(raw.map((id) => id.trim()).filter((id) => SNOWFLAKE.test(id))));
}

export async function updateMarketConfig(formData: FormData) {
  await requireAdmin();
  const t = await getTranslations("errors");

  const updateConfigSchema = z.object({
    maxRefineLevel: z.coerce.number().int().nonnegative(),
    webhookEnabled: z.boolean(),
    imageRecognitionEnabled: z.boolean(),
    geminiModel: z.string().refine(isGeminiModel, t("unsupportedGeminiModel")),
    locale: z.string().refine(isAppLocale, t("unsupportedLocale")),
    dmNotificationsEnabled: z.boolean(),
    maintenanceModeEnabled: z.boolean(),
    optionsEnabled: z.boolean(),
    // Vacío = no tocar el valor ya guardado (patrón "enmascarado + reemplazar":
    // el formulario nunca recibe el valor real, así que no puede reenviarlo).
    // Cuando sí viene un valor, debe ser un webhook de Discord (ver
    // isDiscordWebhookUrl) para no permitir SSRF a hosts arbitrarios.
    webhookUrl: z
      .string()
      .trim()
      .refine(isDiscordWebhookUrl, t("invalidWebhookUrl"))
      .optional(),
    // A diferencia de webhookUrl, este campo no está enmascarado — vacío
    // aquí sí significa "volver a sin configurar" (cae al placeholder).
    siteName: z.string().trim().optional(),
  });

  const parsed = updateConfigSchema.safeParse({
    maxRefineLevel: formData.get("maxRefineLevel"),
    webhookEnabled: formData.get("webhookEnabled") === "on",
    imageRecognitionEnabled: formData.get("imageRecognitionEnabled") === "on",
    geminiModel: formData.get("geminiModel"),
    locale: formData.get("locale"),
    dmNotificationsEnabled: formData.get("dmNotificationsEnabled") === "on",
    maintenanceModeEnabled: formData.get("maintenanceModeEnabled") === "on",
    optionsEnabled: formData.get("optionsEnabled") === "on",
    webhookUrl: formData.get("webhookUrl") || undefined,
    siteName: formData.get("siteName") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? t("invalidData"));
  }
  const adminRoleIds = parseAdminRoleIds(formData);

  await prisma.marketConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      geminiModel: parsed.data.geminiModel,
      dmNotificationsEnabled: parsed.data.dmNotificationsEnabled,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      optionsEnabled: parsed.data.optionsEnabled,
      webhookUrl: parsed.data.webhookUrl ?? null,
      adminRoleIds,
      locale: parsed.data.locale,
      siteName: parsed.data.siteName ?? null,
    },
    update: {
      maxRefineLevel: parsed.data.maxRefineLevel,
      webhookEnabled: parsed.data.webhookEnabled,
      imageRecognitionEnabled: parsed.data.imageRecognitionEnabled,
      geminiModel: parsed.data.geminiModel,
      dmNotificationsEnabled: parsed.data.dmNotificationsEnabled,
      maintenanceModeEnabled: parsed.data.maintenanceModeEnabled,
      optionsEnabled: parsed.data.optionsEnabled,
      ...(parsed.data.webhookUrl ? { webhookUrl: parsed.data.webhookUrl } : {}),
      adminRoleIds,
      locale: parsed.data.locale,
      siteName: parsed.data.siteName ?? null,
    },
  });

  revalidatePath("/admin");
}
