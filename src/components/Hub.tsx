import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Store, Package, Plus, BarChart3, Settings, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Base común de cada tile del hub: misma altura para todos (min-h) con el
// contenido centrado, y la descripción a 2 líneas como mucho (line-clamp) para
// que la altura no baile según lo largo del texto.
const TILE_BASE =
  "group flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-ro-panel-border bg-ro-panel p-4";
const TILE_LINK = `${TILE_BASE} transition-colors hover:border-ro-accent focus-visible:border-ro-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ro-accent`;

function TileIcon({ Icon, muted }: { Icon: LucideIcon; muted?: boolean }) {
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ro-panel-alt ${
        muted ? "text-ro-text-muted" : "text-ro-accent transition-colors group-hover:bg-ro-accent/10"
      }`}
    >
      <Icon size={22} strokeWidth={2} aria-hidden />
    </span>
  );
}

function TileText({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{label}</span>
      {/* La descripción reserva SIEMPRE 2 líneas (min-h) y corta a 2 como mucho
          (line-clamp): así todos los tiles miden igual tenga 1 o 2 líneas. */}
      <span className="line-clamp-2 min-h-10 text-sm text-ro-text-muted">{desc}</span>
    </span>
  );
}

// Hub de inicio (home con sesión): un saludo y accesos directos ("tiles") a las
// secciones. Mercado es el destino principal (ancho completo). BiSes aún no
// tiene página: se muestra como tile no interactivo con aviso "Próximamente".
// Estadísticas y Ajustes solo para admins (ambas rutas están además protegidas
// con requireAdmin en servidor), en una fila de dos columnas.
export async function Hub({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const t = await getTranslations("home");

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
        {/* Mercado: destino principal, a todo el ancho. */}
        <Link href="/market" className={`${TILE_LINK} sm:col-span-2`}>
          <TileIcon Icon={Store} />
          <TileText label={t("tiles.market.label")} desc={t("tiles.market.desc")} />
        </Link>

        <Link href="/my/listings" className={TILE_LINK}>
          <TileIcon Icon={Package} />
          <TileText label={t("tiles.activity.label")} desc={t("tiles.activity.desc")} />
        </Link>
        <Link href="/market?publish=SALE" className={TILE_LINK}>
          <TileIcon Icon={Plus} />
          <TileText label={t("tiles.publish.label")} desc={t("tiles.publish.desc")} />
        </Link>

        {/* BiSes: aún sin página → tile no interactivo con aviso "Próximamente". */}
        <div
          aria-disabled
          title={t("tiles.comingSoon")}
          className={`${TILE_BASE} cursor-default opacity-80 sm:col-span-2`}
        >
          <TileIcon Icon={Trophy} muted />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2">
              <span className="font-semibold">{t("tiles.bis.label")}</span>
              <span className="rounded-full border border-ro-panel-border px-2 py-0.5 text-xs font-medium text-ro-text-muted">
                {t("tiles.comingSoon")}
              </span>
            </span>
            <span className="line-clamp-2 min-h-10 text-sm text-ro-text-muted">{t("tiles.bis.desc")}</span>
          </span>
        </div>

        {/* Estadísticas + Ajustes: solo admins, en una fila de dos columnas. */}
        {isAdmin && (
          <>
            <Link href="/admin/stats" className={TILE_LINK}>
              <TileIcon Icon={BarChart3} />
              <TileText label={t("tiles.stats.label")} desc={t("tiles.stats.desc")} />
            </Link>
            <Link href="/admin" className={TILE_LINK}>
              <TileIcon Icon={Settings} />
              <TileText label={t("tiles.settings.label")} desc={t("tiles.settings.desc")} />
            </Link>
          </>
        )}
      </nav>
    </main>
  );
}
