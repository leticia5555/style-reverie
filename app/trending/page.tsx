import { PageLede } from "@/components/PageLede";
import { TrendTable } from "@/components/TrendTable";
import { trendingInsight } from "@/lib/insights";
import { getCatalog, getTrendSummaries } from "@/lib/trends";

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
