import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { loadMarketConfig } from "@/lib/market-config";

// Se lee de forma perezosa (no a nivel de módulo) para que `next build` no
// exija DISCORD_GUILD_ID en tiempo de compilación — el Worker se construye en
// Cloudflare sin los secretos de runtime. Sigue fallando rápido en el primer
// login si de verdad faltara en el entorno de ejecución.
function getGuildId(): string {
  const id = process.env.DISCORD_GUILD_ID;
  if (!id) {
    throw new Error("Falta la variable de entorno DISCORD_GUILD_ID");
  }
  return id;
}

const DISCORD_ADMINISTRATOR_PERMISSION = BigInt(0x8);

// Lista opcional de IDs de usuario de Discord con acceso de admin, separados
// por comas (p.ej. "123,456"). Pensada para dar acceso al panel a alguien que
// NO tiene el permiso Administrator en el servidor (típico cuando el mercado
// corre en un servidor que no administras). Se SUMA a las otras dos vías
// (permiso nativo de Discord y roles configurados en /admin), no las
// sustituye. Ausente o vacía => nadie entra por aquí. Se lee de forma perezosa
// (no a nivel de módulo) para no exigirla en `next build`.
function getEnvAdminIds(): string[] {
  return (process.env.DISCORD_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

// El endpoint de member (guilds.members.read) no trae los permisos
// calculados del usuario, así que hace falta /users/@me/guilds (scope
// "guilds") y buscar la entrada de nuestro guild ahí — trae "permissions"
// (a nivel de guild, sin overwrites de canal, que es justo lo que hace
// falta para "es admin del servidor sí/no") y "owner".
async function isGuildAdmin(accessToken: string): Promise<boolean> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;

  const guilds = (await res.json()) as {
    id: string;
    owner?: boolean;
    permissions?: string;
  }[];
  const guild = guilds.find((g) => g.id === getGuildId());
  if (!guild) return false;
  if (guild.owner) return true;
  if (!guild.permissions) return false;

  try {
    return (BigInt(guild.permissions) & DISCORD_ADMINISTRATOR_PERMISSION) !== BigInt(0);
  } catch {
    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Sesión corta: obliga a reautenticar (y por tanto a repasar la
  // pertenencia al guild) con regularidad, en vez de confiar en un login
  // hecho hace semanas. Ver norma de seguridad 4.2 del plan original.
  session: { maxAge: 60 * 60 * 24 },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        // "guilds" (además de guilds.members.read) para poder calcular si
        // el usuario es administrador del servidor — ver isGuildAdmin.
        params: { scope: "identify guilds guilds.members.read" },
      },
    }),
  ],
  callbacks: {
    // Deniega el acceso a quien no pertenezca al guild configurado.
    // Se comprueba aquí (con el access_token de esta sesión de login),
    // no solo una vez guardado el perfil. De paso, guarda/actualiza el
    // perfil mínimo del usuario (con sus roles del guild) reutilizando
    // la misma respuesta, sin una segunda llamada a la API de Discord.
    async signIn({ account, profile }) {
      if (!account?.access_token || !profile) return false;

      const res = await fetch(
        `https://discord.com/api/users/@me/guilds/${getGuildId()}/member`,
        { headers: { Authorization: `Bearer ${account.access_token}` } },
      );
      if (!res.ok) return false;

      const member = (await res.json()) as { roles?: string[]; nick?: string | null };
      const discordId = profile.id as string;
      const memberRoles = member.roles ?? [];

      // Rol de acceso a la app: si está configurado en /admin, no basta con
      // pertenecer al guild — hay que tener además ese rol. Los admins están
      // exentos a propósito, para que nadie pueda auto-bloquearse (ni bloquear
      // al resto de admins) eligiendo un rol que no tiene. Sin configurar =
      // acceso solo por pertenencia, como hasta ahora.
      const { accessRoleId, adminRoleIds } = await loadMarketConfig();
      if (accessRoleId && !memberRoles.includes(accessRoleId)) {
        const isAdmin =
          getEnvAdminIds().includes(discordId) ||
          memberRoles.some((r) => adminRoleIds.includes(r)) ||
          (await isGuildAdmin(account.access_token));
        if (!isAdmin) return false;
      }
      // Apodo del servidor si tiene uno puesto; si no, el nombre visible de
      // Discord. Nunca el username (@handle) — así se le reconoce y se le
      // puede escribir DM sin tener que buscar quién es. Ver norma 4.1 del
      // plan original: "solo se muestra la información imprescindible".
      const username = (member.nick ??
        profile.global_name ??
        profile.username) as string;
      const avatarUrl = buildAvatarUrl(
        discordId,
        profile.avatar as string | null,
      );

      // La pertenencia al guild ya está confirmada en este punto: un fallo
      // guardando el perfil (p.ej. la DB caída) no debe bloquear el login
      // de alguien que sí es del guild ni disfrazarse de "no eres del
      // guild" (Auth.js manda cualquier excepción aquí al mismo
      // error=AccessDenied que un signIn()=false, así que de cara al
      // usuario serían indistinguibles). Se registra el fallo y se
      // reintentará solo el guardado en el siguiente login.
      try {
        await db
          .insert(user)
          .values({ id: discordId, username, avatarUrl, guildRoles: member.roles ?? [] })
          .onConflictDoUpdate({
            target: user.id,
            set: { username, avatarUrl, guildRoles: member.roles ?? [] },
          });
      } catch (err) {
        console.error("No se pudo guardar el perfil de usuario tras el login:", err);
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordId = profile.id as string;
        token.discordId = discordId;
        token.avatarUrl = buildAvatarUrl(
          discordId,
          profile.avatar as string | null,
        );

        // El nombre a mostrar (apodo del servidor si lo tiene) y los roles
        // del guild ya los calculó y guardó signIn(); se leen de vuelta en
        // vez de recalcularlos aquí, que exigiría otra llamada a Discord.
        let guildRoles: string[] = [];
        try {
          const [dbUser] = await db
            .select({ username: user.username, guildRoles: user.guildRoles })
            .from(user)
            .where(eq(user.id, discordId))
            .limit(1);
          token.username =
            dbUser?.username ??
            ((profile.global_name ?? profile.username) as string);
          guildRoles = dbUser?.guildRoles ?? [];
        } catch {
          token.username = (profile.global_name ?? profile.username) as string;
        }

        // Se recalcula en cada login (la sesión ya caduca a las 24h y
        // fuerza reautenticar, ver arriba), así que si a alguien le quitan
        // el permiso de Administrator o el rol en Discord, lo pierde aquí
        // también sin necesidad de guardar/mantener nada aparte. Los roles
        // configurados en /admin se SUMAN al permiso nativo, no lo sustituyen.
        const hasAdminPermission = account.access_token
          ? await isGuildAdmin(account.access_token)
          : false;
        const { adminRoleIds } = await loadMarketConfig();
        const hasAdminRole = guildRoles.some((r) => adminRoleIds.includes(r));
        // Tercera vía: ID de usuario en la lista DISCORD_ADMIN_IDS (ver arriba).
        const isEnvAdmin = getEnvAdminIds().includes(discordId);
        token.isAdmin = hasAdminPermission || hasAdminRole || isEnvAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.discordId = token.discordId as string;
      session.user.username = token.username as string;
      session.user.avatarUrl = token.avatarUrl as string | null;
      session.user.isAdmin = (token.isAdmin as boolean | undefined) ?? false;
      return session;
    },
  },
  pages: {
    error: "/auth/error",
  },
});

function buildAvatarUrl(discordId: string, avatarHash: string | null) {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}`;
}
