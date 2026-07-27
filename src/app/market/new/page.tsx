import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/guard";
import { isImageRecognitionAvailable } from "@/lib/item-recognition";
import { loadMarketConfig } from "@/lib/market-config";
import { Panel } from "@/components/Panel";
import { BackLink } from "@/components/BackLink";
import { NewPublicationForm, type PublicationType } from "./NewPublicationForm";

const VALID_TYPES: PublicationType[] = ["SALE", "BUY", "TRADE", "GIFT"];

function isPublicationType(value: string | undefined): value is PublicationType {
  return VALID_TYPES.includes(value as PublicationType);
}

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();

  const { maintenanceModeEnabled } = await loadMarketConfig();
  if (maintenanceModeEnabled && !session.user.isAdmin) redirect("/market");

  const recognitionEnabled = await isImageRecognitionAvailable();
  const raw = await searchParams;
  const rawType = Array.isArray(raw.type) ? raw.type[0] : raw.type;
  const initialType: PublicationType = isPublicationType(rawType) ? rawType : "SALE";
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <BackLink href="/market" label={t("market.nav.backToMarket")} />
      <Panel title={t("nav.newPublication")}>
        <NewPublicationForm recognitionEnabled={recognitionEnabled} initialType={initialType} />
      </Panel>
    </main>
  );
}
