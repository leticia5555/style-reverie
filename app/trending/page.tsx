import { PageLede } from "@/components/PageLede";
import { TrendTable } from "@/components/TrendTable";
import { trendingInsight } from "@/lib/insights";
import { getTrendSummaries } from "@/lib/trends";

export const metadata = {
  title: "Tendencias — Style Reverie",
};

export default function TrendingPage() {
  const rows = getTrendSummaries();

  return (
    <div className="mx-auto max-w-6xl">
      <PageLede
        titleKey="trending.title"
        subtitleKey="trending.subtitle"
        insight={trendingInsight()}
      />
      <TrendTable rows={rows} />
    </div>
  );
}
