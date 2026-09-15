import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrendDetailView } from "@/components/TrendDetailView";
import { getTrendById, getTrendDetail, getTrends } from "@/lib/trends";

export function generateStaticParams() {
  return getTrends().map((trend) => ({ id: trend.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/trends/[id]">): Promise<Metadata> {
  const { id } = await params;
  const trend = getTrendById(id);
  return {
    title: trend ? `${trend.name.es} — Style Reverie` : "Style Reverie",
    description: trend?.summary.es,
  };
}

export default async function TrendDetailPage({
  params,
}: PageProps<"/trends/[id]">) {
  const { id } = await params;
  const detail = getTrendDetail(id);
  if (!detail) notFound();

  return <TrendDetailView detail={detail} />;
}
