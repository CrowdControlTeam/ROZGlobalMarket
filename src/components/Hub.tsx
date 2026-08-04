import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Store, Package, Plus, Gift, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Hub de inicio (home con sesión): sustituye a la navegación por cajón (el
// HamburgerMenu, eliminado). Un saludo y accesos directos ("tiles") a las
// secciones principales. La configuración de admin NO aparece aquí (se entra
// desde el menú de usuario); Estadísticas solo se muestra a admins mientras
// siga bajo /admin/stats (ver Fase 8 del rediseño).
export async function Hub({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const t = await getTranslations("home");

  const tiles: { href: string; label: string; desc: string; Icon: LucideIcon }[] = [
    { href: "/market", label: t("tiles.market.label"), desc: t("tiles.market.desc"), Icon: Store },
    { href: "/my/listings", label: t("tiles.activity.label"), desc: t("tiles.activity.desc"), Icon: Package },
    { href: "/market/new", label: t("tiles.publish.label"), desc: t("tiles.publish.desc"), Icon: Plus },
    { href: "/market?type=GIFT", label: t("tiles.gifts.label"), desc: t("tiles.gifts.desc"), Icon: Gift },
    ...(isAdmin
      ? [{ href: "/admin/stats", label: t("tiles.stats.label"), desc: t("tiles.stats.desc"), Icon: BarChart3 }]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <header className="mb-8 text-center sm:mb-10">
        {/* Saludo grande con el nombre en acento + la pregunta como subtítulo. */}
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {t.rich("hubWelcome", {
            username,
            strong: (chunks) => <strong className="font-semibold text-ro-accent">{chunks}</strong>,
          })}
        </h1>
        <p className="mt-2 text-ro-text-muted">{t("whereTo")}</p>
      </header>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map(({ href, label, desc, Icon }, i) => (
          <Link
            key={href}
            href={href}
            // El primer tile (Mercado) ocupa el ancho completo como destino
            // principal; el resto van en dos columnas.
            className={`group flex items-center gap-4 rounded-xl border border-ro-panel-border bg-ro-panel p-4 transition-colors hover:border-ro-accent focus-visible:border-ro-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ro-accent ${
              i === 0 ? "sm:col-span-2" : ""
            }`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ro-panel-alt text-ro-accent transition-colors group-hover:bg-ro-accent/10">
              <Icon size={22} strokeWidth={2} aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-ro-text-muted">{desc}</span>
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
