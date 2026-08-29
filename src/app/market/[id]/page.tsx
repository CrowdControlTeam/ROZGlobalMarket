import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { ListingDetailContent } from "../ListingDetailContent";
import { DetailHeaderActions } from "./DetailHeaderActions";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("market");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      {/* Cabecera: "← Volver" a la izquierda + acciones (Compartir/Contactar)
          a la derecha, a su misma altura (como la fila de la X en el panel). */}
      <div className="flex items-center justify-between">
        <BackLink href="/market" label={t("nav.backToMarket")} />
        <DetailHeaderActions id={id} />
      </div>
      <Panel>
        <ListingDetailContent id={id} />
      </Panel>
    </main>
  );
}
