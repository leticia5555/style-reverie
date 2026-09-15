import { PageHeading } from "@/components/PageHeading";
import { TrendTable } from "@/components/TrendTable";
import { getTrendSummaries } from "@/lib/trends";

export const metadata = {
  title: "Tendencias — Style Reverie",
};

export default function TrendingPage() {
  const rows = getTrendSummaries();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading titleKey="trending.title" subtitleKey="trending.subtitle" />
      <TrendTable rows={rows} />
    </div>
  );
}
