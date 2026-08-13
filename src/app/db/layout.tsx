import { requireSession } from "@/lib/guard";
import { DbNav } from "./DbNav";

// Layout de la sección DB (3er pilar): contenedor + sub-nav Items/Skills; cada
// página se monta como children. Logueado-only como el resto del sitio.
export default async function DbLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <DbNav />
      {children}
    </main>
  );
}
