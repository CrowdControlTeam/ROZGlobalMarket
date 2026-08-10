import Link from "next/link";
import { getLocale } from "next-intl/server";
import pkg from "../../package.json";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig, DEFAULT_SITE_NAME } from "@/lib/market-config";
import { isAppLocale, DEFAULT_LOCALE } from "@/lib/locale-constants";
import { loadGuildRoleNames } from "@/lib/discord-bot";
import { UserMenu } from "./UserMenu";
import { HeaderNav } from "./HeaderNav";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";

// Displayed version: package.json is the single source of truth. main carries
// the released version (X.Y.Z); develop carries the next minor with a "-dev"
// pre-release suffix (X.(Y+1).0-dev), so the dev Worker shows "-dev" straight
// from the version field — no environment-based suffix needed. Shown at the
// bottom of the user menu.
const APP_VERSION = `v${pkg.version}`;

// Fallback de <Suspense> para SiteHeader (ver layout.tsx) — misma forma
// exacta (alto, borde, posición del logo) para que no haya salto de
// layout al sustituirse por el real, pero sin nada que dependa de datos:
// ni el nombre configurado (usa el placeholder por defecto) ni el menú de
// usuario/botón de publicar (necesitan la sesión resuelta).
export function SiteHeaderFallback() {
  return (
    <header className="border-b border-ro-gold/25 bg-ro-navy text-ro-on-navy">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <span className="font-heading text-sm font-bold leading-none tracking-wide text-ro-on-navy">
          {DEFAULT_SITE_NAME}
        </span>
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
  const [fullUser, { siteName, logoUrl }, rawLocale] = await Promise.all([
    user ? prisma.user.findUnique({ where: { id: user.discordId } }) : null,
    loadMarketConfig(),
    getLocale(),
  ]);
  const locale = isAppLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Nombre del rol en vez del ID cuando el bot puede listarlos (configurado y en
  // el servidor); si no, se cae al ID. Solo se pide si hay roles que resolver.
  const roleNames =
    fullUser && fullUser.guildRoles.length > 0
      ? await loadGuildRoleNames()
      : new Map<string, string>();

  return (
    <header className="border-b border-ro-gold/25 bg-ro-navy text-ro-on-navy">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading text-sm font-bold leading-none tracking-wide text-ro-on-navy"
          >
            {/* Logo opcional junto al título, solo en PC (sm+). Data-URI en la
                config; por eso <img> y no next/image. */}
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- data-URI configurable, no procede next/image
              <img src={logoUrl} alt="" className="hidden h-7 w-auto sm:block" />
            )}
            {siteName}
          </Link>
          {/* Pilares de sección (Mercado · BiS): solo con sesión, ambos
              requieren login. */}
          {fullUser && user && <HeaderNav />}
        </div>

        <div className="flex items-center gap-3">
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
              version={APP_VERSION}
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
