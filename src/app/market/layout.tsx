// Slots paralelos del mercado: @detail (panel de detalle, ?listing=) y @publish
// (modal de publicar, ?publish=). Ambos se interceptan sobre /market vía query
// param — hace falta este layout compartido para declarar los parallel routes.
export default function MarketLayout({
  children,
  detail,
  publish,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
  publish: React.ReactNode;
}) {
  return (
    <>
      {children}
      {detail}
      {publish}
    </>
  );
}
