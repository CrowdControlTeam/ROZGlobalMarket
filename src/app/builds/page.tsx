import { requireSession } from "@/lib/guard";
import { listBuildsDetailed, buildMarketAvailability, myBuildCount } from "@/lib/builds";
import { loadMarketConfig } from "@/lib/market-config";
import { BuildsBrowser } from "./BuildsBrowser";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const session = await requireSession();
  const [builds, { maxBuildsPerUser }, myCount] = await Promise.all([
    listBuildsDetailed(),
    loadMarketConfig(),
    myBuildCount(),
  ]);

  // Disponibilidad en mercado de todos los items presentes, en una sola consulta
  // (el panel derecho la usa para cualquier build sin otra ida al servidor).
  const allItemIds = builds.flatMap((b) => b.entries.map((e) => e.item.id));
  const availability = await buildMarketAvailability(allItemIds);

  return (
    <main className="mx-auto flex max-w-6xl flex-col px-6 py-8 lg:h-[calc(100vh-117px)] lg:overflow-hidden">
      <BuildsBrowser
        builds={builds}
        meId={session.user.discordId}
        availability={Object.fromEntries(availability)}
        maxBuildsPerUser={maxBuildsPerUser}
        myCount={myCount}
      />
    </main>
  );
}
