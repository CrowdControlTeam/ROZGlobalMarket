import { MarketPageContent } from "../MarketPageContent";

export default async function MarketBuyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketPageContent screenType="BUY" searchParams={searchParams} />;
}
