import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/guard";
import { getBuild, buildMarketAvailability } from "@/lib/builds";
import { BackLink } from "@/components/BackLink";
import { BuildDetailView } from "../BuildDetailView";

export const dynamic = "force-dynamic";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("builds");
  const buildRow = await getBuild(id);
  if (!buildRow) notFound();

  // Disponibilidad en el mercado (nº de ventas activas) por item de la build.
  const availability = await buildMarketAvailability(buildRow.entries.map((e) => e.item.id));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/builds" label={t("form.back")} />
      <BuildDetailView
        build={buildRow}
        meId={session.user.discordId}
        availability={Object.fromEntries(availability)}
      />
    </main>
  );
}
