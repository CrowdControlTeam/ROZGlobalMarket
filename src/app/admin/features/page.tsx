import { getTranslations } from "next-intl/server";
import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { bisEntry, bisStage } from "@/db/schema";
import { Panel } from "@/components/Panel";
import { StageManager } from "./StageManager";

// Pestaña "Funcionalidades": configuración por feature, en módulos. De momento
// solo el módulo BiS con la gestión de etapas. El shell lo pone admin/layout.tsx.
export default async function AdminFeaturesPage() {
  const t = await getTranslations("admin.features");
  // order desc = la de mayor order primero (la que sale por defecto en /bis).
  // El nº de entradas por etapa (antes `_count`) va en un groupBy aparte.
  const [stages, counts] = await Promise.all([
    db.select({ id: bisStage.id, label: bisStage.label }).from(bisStage).orderBy(desc(bisStage.order)),
    db.select({ stageId: bisEntry.stageId, n: count() }).from(bisEntry).groupBy(bisEntry.stageId),
  ]);
  const countMap = new Map(counts.map((c) => [c.stageId, c.n]));
  const data = stages.map((s) => ({ id: s.id, label: s.label, count: countMap.get(s.id) ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("bis.title")}>
        <StageManager stages={data} />
      </Panel>
    </div>
  );
}
