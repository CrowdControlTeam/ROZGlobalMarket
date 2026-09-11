import { requireSession } from "@/lib/guard";
import { ToolsNav } from "./ToolsNav";

// Layout de la sección Tools (4º pilar): contenedor + sub-nav de herramientas;
// cada tool se monta como children. Logueado-only como el resto del sitio
// (requireSession, no requireMarketSession: no depende del modo mantenimiento).
export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <ToolsNav />
      {children}
    </main>
  );
}
