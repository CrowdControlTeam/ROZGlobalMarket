import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/Panel";
import { StageManager } from "./StageManager";

// Pestaña "Funcionalidades": configuración por feature, en módulos. De momento
// solo el módulo BiS con la gestión de etapas. El shell lo pone admin/layout.tsx.
export default async function AdminFeaturesPage() {
  const t = await getTranslations("admin.features");
  // order desc = la de mayor order primero (la que sale por defecto en /bis).
  const stages = await prisma.bisStage.findMany({
    orderBy: { order: "desc" },
    include: { _count: { select: { entries: true } } },
  });
  const data = stages.map((s) => ({ id: s.id, label: s.label, count: s._count.entries }));

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("bis.title")}>
        <StageManager stages={data} />
      </Panel>
    </div>
  );
}
