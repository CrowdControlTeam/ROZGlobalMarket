import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { ListingDetailContent } from "../ListingDetailContent";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("market");

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label={t("nav.backToMarket")} />
      <Panel>
        <ListingDetailContent id={id} />
      </Panel>
    </main>
  );
}
