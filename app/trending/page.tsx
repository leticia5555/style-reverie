import { AccumulatingSection } from "@/components/AccumulatingSection";
import { PageLede } from "@/components/PageLede";
import { TrendTable } from "@/components/TrendTable";
import { trendingInsight } from "@/lib/insights";
import { trendImages } from "@/lib/trend-image";
import { getCatalog, getTrendSummaries } from "@/lib/trends";

/**
 * Lee el catálogo de Postgres, que el cron reescribe cada día. Sin esto la
 * página se congelaba en el build y no volvía a cambiar nunca: el deploy
 * pasaba a ser la única forma de ver dato nuevo.
 */
export const revalidate = 300;

export const metadata = {
  title: "Tendencias — Style Reverie",
};

export default async function TrendingPage() {
  const { trends, accumulating } = await getCatalog();
  const rows = getTrendSummaries(trends);
  // Se resuelven en el servidor: lib/trend-image lee del disco y arrastrarlo
  // a un componente cliente metería node:fs en el bundle del navegador.
  const images = Object.fromEntries(await trendImages(rows.map((row) => row.id)));

  return (
    <div className="mx-auto max-w-6xl">
      <PageLede
        titleKey="trending.title"
        subtitleKey="trending.subtitle"
        insight={trendingInsight(trends)}
      />
      <TrendTable rows={rows} images={images} />
      <AccumulatingSection trends={accumulating} />
    </div>
  );
}
