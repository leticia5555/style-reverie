import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrendDetailView } from "@/components/TrendDetailView";
import { splitByOrigin } from "@/lib/origin";
import {
  getCatalog,
  getTrendById,
  getTrendDetail,
  getTrends,
} from "@/lib/trends";

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
  const { trends, origins } = await getCatalog();
  const detail = getTrendDetail(id, trends);
  if (!detail) notFound();

  return (
    <TrendDetailView
      detail={detail}
      split={splitByOrigin(detail.series, origins.get(id))}
    />
  );
}
