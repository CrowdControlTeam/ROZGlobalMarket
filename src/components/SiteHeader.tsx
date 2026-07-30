import Link from "next/link";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig, DEFAULT_SITE_NAME } from "@/lib/market-config";
import { isAppLocale, DEFAULT_LOCALE } from "@/lib/locale-constants";
import { loadGuildRoleNames } from "@/lib/discord-bot";
import { HamburgerMenu } from "./HamburgerMenu";
import { UserMenu } from "./UserMenu";
import { CreatePublicationButton } from "./CreatePublicationButton";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";

// Fallback de <Suspense> para SiteHeader (ver layout.tsx) — misma forma
// exacta (alto, borde, posición del logo) para que no haya salto de
// layout al sustituirse por el real, pero sin nada que dependa de datos:
// ni el nombre configurado (usa el placeholder por defecto) ni el menú de
// usuario/botón de publicar (necesitan la sesión resuelta).
export function SiteHeaderFallback() {
  return (
    <header className="border-b border-ro-gold/25 bg-ro-navy text-ro-on-navy">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <span className="font-heading text-[0.65rem] leading-none tracking-wide text-ro-on-navy sm:text-xs">
            {DEFAULT_SITE_NAME}
          </span>
        </div>
        <div className="flex items-center gap-3" />
      </div>
    </header>
  );
}

type SessionUser = {
  discordId: string;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export async function SiteHeader({
  user,
  theme,
}: {
  user: SessionUser | null;
  theme: "light" | "dark";
}) {
  const [fullUser, { maintenanceModeEnabled, siteName }, rawLocale] = await Promise.all([
    user ? prisma.user.findUnique({ where: { id: user.discordId } }) : null,
    loadMarketConfig(),
    getLocale(),
  ]);
  const canCreate = !!user && (!maintenanceModeEnabled || user.isAdmin);
  const locale = isAppLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Nombre del rol en vez del ID cuando el bot puede listarlos (configurado y en
  // el servidor); si no, se cae al ID. Solo se pide si hay roles que resolver.
  const roleNames =
    fullUser && fullUser.guildRoles.length > 0
      ? await loadGuildRoleNames()
      : new Map<string, string>();

  return (
    <header className="border-b border-ro-gold/25 bg-ro-navy text-ro-on-navy">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <Link
            href="/market"
            className="font-heading text-[0.65rem] leading-none tracking-wide text-ro-on-navy sm:text-xs"
          >
            {siteName}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && <CreatePublicationButton />}
          {fullUser && user ? (
            <UserMenu
              user={{
                discordId: fullUser.id,
                username: fullUser.username,
                avatarUrl: fullUser.avatarUrl,
                guildRoles: fullUser.guildRoles.map((id) => roleNames.get(id) ?? id),
                createdAt: fullUser.createdAt,
                isAdmin: user.isAdmin,
              }}
              theme={theme}
              locale={locale}
            />
          ) : (
            // Sin sesión (login) los controles no viven en el menú de usuario
            // (que no existe), así que se muestran sueltos en la cabecera.
            <>
              <ThemeToggle initial={theme} />
              <LocaleSwitcher initial={locale} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
