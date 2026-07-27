import { getTranslations } from "next-intl/server";
import { getListings, type MarketFilters as MarketFiltersType } from "@/lib/market";
import { loadMarketConfig } from "@/lib/market-config";
import { isDmFeatureAvailable } from "@/lib/discord-bot";
import { MarketResults } from "./MarketResults";

// La parte de /market que de verdad depende de la base de datos — filtros,
// título y orden (en MarketPageContent) no dependen de nada y se pintan al
// instante; esto se envuelve en <Suspense> aparte para que solo el grid de
// listings muestre placeholder mientras carga.
export async function MarketListingsSection({
  filters,
  currentUserId,
  isAdmin,
}: {
  filters: MarketFiltersType;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [{ listings, nextCursor }, { maintenanceModeEnabled }, dmAvailable, t] = await Promise.all([
    getListings(filters),
    loadMarketConfig(),
    isDmFeatureAvailable(),
    getTranslations("market"),
  ]);

  return (
    <>
      {maintenanceModeEnabled && (
        <p className="mb-4 rounded-md border-2 border-ro-gold-dark bg-ro-gold/10 px-4 py-2 text-sm text-ro-text">
          {isAdmin ? t("maintenance.admin") : t("maintenance.user")}
        </p>
      )}
      <MarketResults
        initialListings={listings}
        initialCursor={nextCursor}
        filters={filters}
        currentUserId={currentUserId}
        dmAvailable={dmAvailable}
      />
    </>
  );
}
