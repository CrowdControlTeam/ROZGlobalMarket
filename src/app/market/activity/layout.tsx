import { MyActivityTabs } from "@/components/MyActivityTabs";
import { countMyPendingDeals } from "@/lib/pending-deals";

// Sub-navegación de "Mi actividad" (Publicaciones / Pendientes / Regalos). El
// marco —contenedor + hub, cuyo ítem activo hace de título— lo pone el layout de
// /market; aquí solo las pestañas. La sesión ya la exige ese layout padre.
export default async function ActivityLayout({ children }: { children: React.ReactNode }) {
  // Mismo contador que el badge del hub (dedup por request vía cache()).
  const pendingCount = await countMyPendingDeals();
  return (
    <>
      <MyActivityTabs pendingCount={pendingCount} />
      {children}
    </>
  );
}
