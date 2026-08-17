import { requireMarketSession } from "@/lib/guard";
import { MarketNav } from "./MarketNav";

// Layout de la sección Mercado. Hace dos cosas:
//  1) Declara los parallel routes de los modales: @detail (panel de detalle,
//     ?listing=), @publish (modal de publicar, ?publish=), @edit (modal de
//     editar, ?edit=) y @repost (modal de republicar, ?repost=), interceptados
//     sobre /market vía query param.
//  2) Monta el hub superior + contenedor común, de modo que /market,
//     /market/activity y /market/statistics comparten el mismo marco (el hub)
//     sin duplicarlo: cada página se monta como children.
// requireMarketSession protege toda la sección (logueado-only) y, en
// mantenimiento, manda a /maintenance a los no-admin — es el único sitio donde
// se cierra el mercado (/bis y /db quedan abiertos). Aporta isAdmin al hub; las
// páginas mantienen sus guards propios (p. ej. requireAdmin en statistics).
export default async function MarketLayout({
  children,
  detail,
  publish,
  edit,
  repost,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
  publish: React.ReactNode;
  edit: React.ReactNode;
  repost: React.ReactNode;
}) {
  const session = await requireMarketSession();
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <MarketNav isAdmin={session.user.isAdmin} />
        {children}
      </main>
      {detail}
      {publish}
      {edit}
      {repost}
    </>
  );
}
