import { requireSession } from "@/lib/guard";
import { MarketNav } from "./MarketNav";

// Layout de la sección Mercado. Hace dos cosas:
//  1) Declara los parallel routes de los modales: @detail (panel de detalle,
//     ?listing=), @publish (modal de publicar, ?publish=) y @edit (modal de
//     editar, ?edit=), interceptados sobre /market vía query param.
//  2) Monta el hub superior + contenedor común, de modo que /market,
//     /market/activity y /market/statistics comparten el mismo marco (el hub)
//     sin duplicarlo: cada página se monta como children.
// requireSession aquí protege toda la sección (ya era logueado-only) y aporta
// isAdmin al hub; las páginas mantienen sus guards propios (p. ej. requireAdmin
// en statistics).
export default async function MarketLayout({
  children,
  detail,
  publish,
  edit,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
  publish: React.ReactNode;
  edit: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <MarketNav isAdmin={session.user.isAdmin} />
        {children}
      </main>
      {detail}
      {publish}
      {edit}
    </>
  );
}
