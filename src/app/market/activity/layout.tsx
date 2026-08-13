import { MyActivityTabs } from "@/components/MyActivityTabs";

// Sub-navegación de "Mi actividad" (Publicaciones / Pendientes / Regalos). El
// marco —contenedor + hub, cuyo ítem activo hace de título— lo pone el layout de
// /market; aquí solo las pestañas. La sesión ya la exige ese layout padre.
export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MyActivityTabs />
      {children}
    </>
  );
}
