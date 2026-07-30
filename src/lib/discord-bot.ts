// Llamadas autenticadas "como bot" (Authorization: Bot <token>), separadas
// de auth.ts (que usa el access_token del usuario que hace login). El bot
// se usa para listar roles con nombre real en /admin (si no está
// configurado, el panel cae a introducir IDs a mano — ver
// AdminConfigForm.tsx) y para las DMs de transacción (ver sendDirectMessage
// más abajo).
import { cache } from "react";
import { loadMarketConfig } from "@/lib/market-config";

export type GuildRolesResult =
  | { status: "no_bot" }
  | { status: "error"; message: string }
  | { status: "ok"; roles: { id: string; name: string }[] };

export async function fetchGuildRoles(): Promise<GuildRolesResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token) return { status: "no_bot" };
  if (!guildId) return { status: "error", message: "Falta DISCORD_GUILD_ID" };

  let res: Response;
  try {
    res = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
  } catch {
    return { status: "error", message: "No se pudo contactar con la API de Discord" };
  }

  if (!res.ok) {
    return {
      status: "error",
      message:
        res.status === 403 || res.status === 404
          ? "El bot no tiene acceso al servidor (¿está invitado?)"
          : `Discord respondió ${res.status}`,
    };
  }

  const roles = (await res.json()) as { id: string; name: string }[];
  return {
    status: "ok",
    roles: roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type BotStatus = "no_token" | "not_in_guild" | "error" | "ok";

// Comprobar si el bot sigue en el servidor es una llamada a Discord, e
// isDmFeatureAvailable se invoca en varias páginas. El bot entra/sale del
// servidor rara vez, así que se memoiza: cache() dedupe dentro de una misma
// request, y una caché de módulo con TTL corto evita repetir la llamada entre
// requests sin quedarse pegado a un estado viejo mucho rato. (En Workers la
// caché vive por isolate — best-effort, suficiente aquí.)
const BOT_STATUS_TTL_MS = 5 * 60 * 1000;
let botStatusCache: { value: BotStatus; at: number } | null = null;

async function fetchBotStatus(): Promise<BotStatus> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token) return "no_token";
  if (!guildId) return "error";

  let res: Response;
  try {
    res = await fetch(`https://discord.com/api/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
  } catch {
    return "error";
  }
  if (res.ok) return "ok";
  // 403/404 = el bot no está en ese servidor (no invitado). Otros códigos
  // (401 token inválido, 5xx…) son un error de configuración/red distinto.
  if (res.status === 403 || res.status === 404) return "not_in_guild";
  return "error";
}

export const getBotStatus = cache(async (): Promise<BotStatus> => {
  const now = Date.now();
  if (botStatusCache && now - botStatusCache.at < BOT_STATUS_TTL_MS) {
    return botStatusCache.value;
  }
  const value = await fetchBotStatus();
  // Los "error" (transitorios/red) no se cachean, para reintentar antes.
  if (value !== "error") botStatusCache = { value, at: now };
  return value;
});

// Mapa id→nombre de los roles del servidor, para mostrar el NOMBRE del rol (no
// el ID) en el menú de usuario cuando el bot está configurado y en el servidor.
// Se cachea con TTL corto (los roles cambian rara vez) porque el header se
// renderiza en cada página — mismo criterio que getBotStatus. Si el bot no está
// disponible se devuelve un mapa vacío y el caller cae al ID.
const ROLE_NAMES_TTL_MS = 5 * 60 * 1000;
let roleNamesCache: { value: Map<string, string>; at: number } | null = null;

export const loadGuildRoleNames = cache(async (): Promise<Map<string, string>> => {
  const now = Date.now();
  if (roleNamesCache && now - roleNamesCache.at < ROLE_NAMES_TTL_MS) {
    return roleNamesCache.value;
  }
  const result = await fetchGuildRoles();
  const map = new Map<string, string>();
  if (result.status === "ok") {
    for (const r of result.roles) map.set(r.id, r.name);
    roleNamesCache = { value: map, at: now };
  }
  // no_bot/error: no se cachea (para reintentar) y se devuelve vacío => fallback a IDs.
  return map;
});

// Para que la UI (nombres clicables, ver UserMention.tsx) sepa si tiene
// sentido ofrecer la opción en absoluto — mismo criterio que usa
// sendDirectMessage por debajo, pero sin intentar mandar nada. Ahora exige
// además que el bot esté DE VERDAD en el servidor (no solo que haya token): si
// lo expulsan, los DMs dejan de entregarse, así que la UI no debe ofrecerlos.
export async function isDmFeatureAvailable(): Promise<boolean> {
  const { dmNotificationsEnabled } = await loadMarketConfig();
  if (!dmNotificationsEnabled) return false;
  return (await getBotStatus()) === "ok";
}

export type DirectMessagePayload = {
  title: string;
  color: number;
  itemIconUrl: string;
  url?: string;
  fields: { name: string; value: string; inline?: boolean }[];
};

// Norma 2.10 del plan original: DM al destinatario de una transacción (compra,
// petición aceptada, trade aceptado, regalo). Nunca debe tumbar la
// transacción que la origina (ya se guardó en la DB) ni reintentar si
// falla — motivos típicos: el bot no está configurado, el destinatario
// tiene los DMs cerrados a miembros del servidor, o le ha bloqueado.
// Centraliza el gating (toggle + token) aquí en vez de en cada caller —
// peticiones de compra, trades y regalos llamarán a esto más adelante, así
// que conviene que sea imposible olvidarse de comprobarlo en algún sitio.
export async function sendDirectMessage(discordId: string, payload: DirectMessagePayload): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;

  const { dmNotificationsEnabled } = await loadMarketConfig();
  if (!dmNotificationsEnabled) return;

  try {
    const channelRes = await fetch("https://discord.com/api/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    if (!channelRes.ok) return;
    const channel = (await channelRes.json()) as { id: string };

    const embed = {
      title: payload.title,
      url: payload.url,
      color: payload.color,
      thumbnail: { url: payload.itemIconUrl },
      fields: payload.fields,
      timestamp: new Date().toISOString(),
    };

    const msgRes = await fetch(`https://discord.com/api/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    // Si Discord rechaza el embed en sí (400), se manda como alternativa un
    // texto plano con la misma información — un fallo de entrega (bloqueo,
    // DMs cerrados) no cae aquí, esos ya se filtran arriba en channelRes.
    if (!msgRes.ok && msgRes.status === 400) {
      const plain = [payload.title, ...payload.fields.map((f) => `${f.name}: ${f.value}`)].join("\n");
      await fetch(`https://discord.com/api/channels/${channel.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: plain }),
      });
    }
  } catch {
    // Silencioso a propósito — ver comentario de la función.
  }
}
