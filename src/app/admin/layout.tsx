import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminNav } from "./AdminNav";

// Shell común de /admin: protege toda la sección (requireAdmin), pone el título
// y las pestañas (General / Funcionalidades). Cada ruta hija aporta su contenido.
// Ya no hay breadcrumb "Volver al mercado": el acceso a admin vive en el menú.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 font-heading text-lg tracking-wide text-ro-text">{t("title")}</h1>
      <AdminNav />
      {children}
    </main>
  );
}
