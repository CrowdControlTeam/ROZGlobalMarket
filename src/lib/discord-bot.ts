// Llamadas autenticadas "como bot" (Authorization: Bot <token>), separadas
// de auth.ts (que usa el access_token del usuario que hace login). El bot
// se usa para listar roles con nombre real en /admin (si no está
// configurado, el panel cae a introducir IDs a mano — ver
// AdminConfigForm.tsx) y para las DMs de transacción (ver sendDirectMessage
// más abajo).
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

// Para que la UI (nombres clicables, ver UserMention.tsx) sepa si tiene
// sentido ofrecer la opción en absoluto — mismo criterio que usa
// sendDirectMessage por debajo (toggle Y token), pero sin intentar mandar
// nada. Se resuelve una vez por página (server component) y se pasa hacia
// abajo, no una llamada por cada mención.
export async function isDmFeatureAvailable(): Promise<boolean> {
  if (!process.env.DISCORD_BOT_TOKEN) return false;
  const { dmNotificationsEnabled } = await loadMarketConfig();
  return dmNotificationsEnabled;
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
