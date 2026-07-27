import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadMarketConfig, DEFAULT_SITE_NAME } from "@/lib/market-config";
import { HamburgerMenu } from "./HamburgerMenu";
import { UserMenu } from "./UserMenu";
import { CreatePublicationButton } from "./CreatePublicationButton";

// Fallback de <Suspense> para SiteHeader (ver layout.tsx) — misma forma
// exacta (alto, borde, posición del logo) para que no haya salto de
// layout al sustituirse por el real, pero sin nada que dependa de datos:
// ni el nombre configurado (usa el placeholder por defecto) ni el menú de
// usuario/botón de publicar (necesitan la sesión resuelta).
export function SiteHeaderFallback() {
  return (
    <header className="border-b-4 border-ro-panel-border bg-ro-bg-alt">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <span className="font-heading text-[0.65rem] leading-none tracking-wide text-ro-gold sm:text-xs">
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

export async function SiteHeader({ user }: { user: SessionUser | null }) {
  const [fullUser, { maintenanceModeEnabled, siteName }] = await Promise.all([
    user ? prisma.user.findUnique({ where: { id: user.discordId } }) : null,
    loadMarketConfig(),
  ]);
  const canCreate = !!user && (!maintenanceModeEnabled || user.isAdmin);

  return (
    <header className="border-b-4 border-ro-panel-border bg-ro-bg-alt">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <Link
            href="/market"
            className="font-heading text-[0.65rem] leading-none tracking-wide text-ro-gold sm:text-xs"
          >
            {siteName}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && <CreatePublicationButton />}
          {fullUser && user && (
            <UserMenu
              user={{
                discordId: fullUser.id,
                username: fullUser.username,
                avatarUrl: fullUser.avatarUrl,
                guildRoles: fullUser.guildRoles,
                createdAt: fullUser.createdAt,
                isAdmin: user.isAdmin,
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
