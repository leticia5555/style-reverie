import { PageLede } from "@/components/PageLede";
import { TrendTable } from "@/components/TrendTable";
import { trendingInsight } from "@/lib/insights";
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
  const { trends } = await getCatalog();
  const rows = getTrendSummaries(trends);

  return (
    <div className="mx-auto max-w-6xl">
      <PageLede
        titleKey="trending.title"
        subtitleKey="trending.subtitle"
        insight={trendingInsight(trends)}
      />
      <TrendTable rows={rows} />
    </div>
  );
}
