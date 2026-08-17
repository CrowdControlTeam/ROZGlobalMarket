import { getMarketConfig } from "@/lib/admin-config";
import { Panel } from "@/components/Panel";
import { AdminConfigForm } from "./AdminConfigForm";

// Pestaña "General": configuración del mercado (nombre del sitio, apariencia,
// accesos, webhook, DM, reconocimiento, options, mantenimiento). El shell
// (título + pestañas + requireAdmin) lo pone admin/layout.tsx.
export default async function AdminPage() {
  const config = await getMarketConfig();
  return (
    <Panel>
      <AdminConfigForm config={config} />
    </Panel>
  );
}
