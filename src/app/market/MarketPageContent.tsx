import { Suspense } from "react";
import { z } from "zod";
import { ItemCategory, EquipSlot, WeaponType, ListingType } from "@prisma/client";
import { isMarketSort, type MarketFilters as MarketFiltersType } from "@/lib/market";
import { requireSession } from "@/lib/guard";
import { MarketNav } from "./MarketNav";
import { MarketFilters } from "./MarketFilters";
import { SearchTabs } from "./SearchTabs";
import { SegmentedTypeSelector } from "./SegmentedTypeSelector";
import { MarketListingsSection } from "./MarketListingsSection";
import { MarketResultsSkeleton } from "./MarketResultsSkeleton";

const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.enum(ItemCategory).optional(),
  slot: z.enum(EquipSlot).optional(),
  weaponType: z.enum(WeaponType).optional(),
  // El tipo (Venta/Compra/Interc./Regalo) es un filtro más, fijado desde la
  // query string por el SegmentedTypeSelector — ya no hay rutas por tipo.
  type: z.enum(ListingType).optional(),
  posterId: z.string().trim().min(1).optional(),
  option1Stat: z.string().trim().min(1).optional(),
  option1Min: z.coerce.number().int().optional(),
  option1Max: z.coerce.number().int().optional(),
  option2Stat: z.string().trim().min(1).optional(),
  option2Min: z.coerce.number().int().optional(),
  option2Max: z.coerce.number().int().optional(),
  option3Stat: z.string().trim().min(1).optional(),
  option3Min: z.coerce.number().int().optional(),
  option3Max: z.coerce.number().int().optional(),
  refineMin: z.coerce.number().int().nonnegative().optional(),
  refineMax: z.coerce.number().int().nonnegative().optional(),
  cardSlotsMin: z.coerce.number().int().nonnegative().optional(),
  cardSlotsMax: z.coerce.number().int().nonnegative().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z
    .string()
    .optional()
    .transform((v) => (v && isMarketSort(v) ? v : "newest")),
});

// Mercado unificado: una sola pantalla para todos los tipos. El tipo se lee de
// `?type=` (lo fija el SegmentedTypeSelector), no de la ruta — antes había
// /market/sale|buy|trade y /market/gifts, ahora fusionados aquí.
export async function MarketPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(raw.q),
    category: firstValue(raw.category),
    slot: firstValue(raw.slot),
    weaponType: firstValue(raw.weaponType),
    type: firstValue(raw.type),
    posterId: firstValue(raw.posterId),
    option1Stat: firstValue(raw.option1Stat),
    option1Min: firstValue(raw.option1Min),
    option1Max: firstValue(raw.option1Max),
    option2Stat: firstValue(raw.option2Stat),
    option2Min: firstValue(raw.option2Min),
    option2Max: firstValue(raw.option2Max),
    option3Stat: firstValue(raw.option3Stat),
    option3Min: firstValue(raw.option3Min),
    option3Max: firstValue(raw.option3Max),
    refineMin: firstValue(raw.refineMin),
    refineMax: firstValue(raw.refineMax),
    cardSlotsMin: firstValue(raw.cardSlotsMin),
    cardSlotsMax: firstValue(raw.cardSlotsMax),
    minPrice: firstValue(raw.minPrice),
    maxPrice: firstValue(raw.maxPrice),
    sort: firstValue(raw.sort),
  });

  const filters: MarketFiltersType = parsed.success ? parsed.data : { sort: "newest" };

  // La key del Suspense NO incluye `q` (ver comentario abajo).
  const suspenseKeyFilters = { ...filters };
  delete suspenseKeyFilters.q;
  const suspenseKey = JSON.stringify(suspenseKeyFilters);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* Hub superior (fuera de las pestañas) + barra de "Mis búsquedas". El
          selector de tipo queda DENTRO del contexto de la pestaña activa (cada
          búsqueda tiene su propio tipo), así que va debajo de las pestañas. */}
      <MarketNav />
      <div className="mb-3">
        <SearchTabs />
      </div>
      <div className="mb-4">
        <SegmentedTypeSelector />
      </div>

      {/* Los filtros se auto-posicionan (fijos en el margen izquierdo en
          desktop; botón "Filtros" + bottom-sheet en móvil), así que los
          resultados ocupan el ancho completo del contenedor. */}
      <MarketFilters />

      {/* key en el propio Suspense: al cambiar cualquier filtro/orden, React
          trata la sección como nueva y muestra el skeleton mientras llega el
          resultado. Excluimos `q` de la key a propósito: el buscador aplica al
          vuelo, así que si `q` remontara la sección, el input perdería el foco
          en cada tecla. Al dejarlo fuera, la búsqueda actualiza los resultados
          en su sitio (sin skeleton) y el foco se conserva. */}
      <Suspense key={suspenseKey} fallback={<MarketResultsSkeleton />}>
        <MarketListingsSection
          filters={filters}
          currentUserId={session.user.discordId}
          isAdmin={session.user.isAdmin}
        />
      </Suspense>
    </main>
  );
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
