// Slot @detail (ver market/@detail/) para el panel de detalle interceptado
// — hace falta un layout compartido para declarar el parallel route, algo
// que hasta ahora /market no necesitaba.
export default function MarketLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <>
      {children}
      {detail}
    </>
  );
}
