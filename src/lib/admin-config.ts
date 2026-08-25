"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { loadMarketConfig, bustConfigCache } from "@/lib/market-config";
import { getOptionsCatalogCount } from "@/lib/item-options";
import { fetchGuildRoles, getBotStatus } from "@/lib/discord-bot";
import { GEMINI_MODEL_VALUES, isGeminiModel } from "@/lib/gemini-model-constants";
import { isDiscordWebhookUrl } from "@/lib/discord-webhook-constants";
import {
  MAX_LOGO_BYTES,
  MAX_HOME_IMAGE_BYTES,
  isImageDataUrl,
  dataUrlByteSize,
} from "@/lib/branding-constants";

// El valor real de un secreto nunca sale del servidor una vez guardado —
// esto es lo único que llega al cliente para representarlo en el formulario.
function maskSecret(value: string): string {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

export async function getMarketConfig() {
  await requireAdmin();

  const [config, optionsCatalogCount, guildRolesResult, botStatus, rawConfig, t] = await Promise.all([
    loadMarketConfig(),
    getOptionsCatalogCount(),
    fetchGuildRoles(),
    getBotStatus(),
    // logoUrl/homeImageUrl ya no vienen de loadMarketConfig (se dejaron fuera
    // por egress); aquí sí se leen (admin-only, poco tráfico) para el formulario.
    prisma.marketConfig.findUnique({
      where: { id: 1 },
      select: { siteName: true, logoUrl: true, homeImageUrl: true },
    }),
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
    botStatus,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    optionsEnabled: config.optionsEnabled,
    optionsCatalogCount,
    adminRoleIds: config.adminRoleIds,
    accessRoleId: config.accessRoleId,
    bisEditorRoleId: config.bisEditorRoleId,
    guildRolesResult,
    // Se devuelven completos (admin-only): el formulario los reenvía tal cual
    // si no se cambian (así "sin tocar" = conservar; vacío = borrar).
    logoUrl: rawConfig?.logoUrl ?? null,
    homeImageUrl: rawConfig?.homeImageUrl ?? null,
  };
}

// IDs de rol de Discord (snowflakes): solo dígitos. Se filtra en vez de
// rechazar todo el formulario por una línea mal pegada — es una lista de
// texto libre en el caso sin bot, conviene ser tolerante.
const SNOWFLAKE = /^\d{15,25}$/;

// ── Guardado POR CAMPO (autoguardado del formulario de admin) ───────────────
// Cada control del formulario guarda solo su campo, validado de forma
// independiente (así un campo a medio escribir no bloquea los demás). El upsert
// crea la fila con defaults si aún no existe (todos los campos tienen @default).

type BoolField =
  | "webhookEnabled"
  | "imageRecognitionEnabled"
  | "dmNotificationsEnabled"
  | "maintenanceModeEnabled"
  | "optionsEnabled";

export type ConfigFieldUpdate =
  | { field: BoolField; value: boolean }
  | { field: "siteName"; value: string }
  | { field: "maxRefineLevel"; value: number }
  | { field: "webhookUrl"; value: string }
  | { field: "geminiModel"; value: string }
  | { field: "accessRoleId" | "bisEditorRoleId"; value: string }
  | { field: "adminRoleIds"; value: string[] }
  | { field: "logoUrl" | "homeImageUrl"; value: string | null };

// Valida un campo y devuelve el fragmento de update de Prisma. Lanza con el
// mensaje i18n adecuado si el valor no es válido. El switch es exhaustivo sobre
// el union (TS lo verifica por el tipo de retorno sin `undefined`).
function buildFieldData(
  u: ConfigFieldUpdate,
  t: Awaited<ReturnType<typeof getTranslations>>,
): Prisma.MarketConfigUncheckedUpdateInput {
  switch (u.field) {
    case "webhookEnabled":
    case "imageRecognitionEnabled":
    case "dmNotificationsEnabled":
    case "maintenanceModeEnabled":
    case "optionsEnabled":
      return { [u.field]: u.value };
    case "siteName":
      return { siteName: u.value.trim() || null };
    case "maxRefineLevel": {
      const n = z.coerce.number().int().nonnegative().safeParse(u.value);
      if (!n.success) throw new Error(t("invalidData"));
      return { maxRefineLevel: n.data };
    }
    case "webhookUrl": {
      const v = u.value.trim();
      // Vacío no se guarda por aquí (patrón enmascarado): la UI solo manda ✓ con
      // un valor escrito. Un valor debe ser un webhook de Discord (anti-SSRF).
      if (!v) throw new Error(t("invalidData"));
      if (!isDiscordWebhookUrl(v)) throw new Error(t("invalidWebhookUrl"));
      return { webhookUrl: v };
    }
    case "geminiModel":
      if (!isGeminiModel(u.value)) throw new Error(t("unsupportedGeminiModel"));
      return { geminiModel: u.value };
    case "accessRoleId":
    case "bisEditorRoleId": {
      const v = u.value.trim();
      return { [u.field]: SNOWFLAKE.test(v) ? v : null };
    }
    case "adminRoleIds": {
      const ids = Array.from(
        new Set(u.value.map((s) => s.trim()).filter((id) => SNOWFLAKE.test(id))),
      );
      return { adminRoleIds: ids };
    }
    case "logoUrl":
    case "homeImageUrl": {
      const raw = u.value;
      if (raw === null || raw.trim() === "") return { [u.field]: null };
      const v = raw.trim();
      if (!isImageDataUrl(v)) throw new Error(t("invalidImage"));
      const max = u.field === "logoUrl" ? MAX_LOGO_BYTES : MAX_HOME_IMAGE_BYTES;
      if (dataUrlByteSize(v) > max) throw new Error(t("imageTooLarge"));
      return { [u.field]: v };
    }
  }
}

export async function setMarketConfigField(update: ConfigFieldUpdate): Promise<void> {
  await requireAdmin();
  const t = await getTranslations("errors");
  const data = buildFieldData(update, t);
  await prisma.marketConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...data } as Prisma.MarketConfigUncheckedCreateInput,
    update: data,
  });
  // Invalida el cache en memoria para que el cambio se refleje ya (al menos en
  // este isolate; el resto caduca en <=TTL).
  bustConfigCache();
  revalidatePath("/admin");
}
