// Slots paralelos del mercado: @detail (panel de detalle, ?listing=), @publish
// (modal de publicar, ?publish=) y @edit (modal de editar, ?edit=). Los tres se
// interceptan sobre /market vía query param — hace falta este layout compartido
// para declarar los parallel routes.
export default function MarketLayout({
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
  return (
    <>
      {children}
      {detail}
      {publish}
      {edit}
    </>
  );
}
