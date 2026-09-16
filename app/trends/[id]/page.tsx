import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { byTier, fetchAwinProducts } from "@/lib/sources/awin";
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

  /**
   * Las fotos de producto salen del feed de afiliados y solo de ahí. Si el
   * feed no trae imagen para ninguna, `byTier` deja los tres niveles vacíos y
   * la tira no se pinta.
   */
  const links = Object.values(detail.shopping).flat();
  const products = byTier(await fetchAwinProducts(detail.summary.id, links));

  return (
    <TrendDetailView
      products={products}
      detail={detail}
      split={splitByOrigin(detail.series, origins.get(id))}
    />
  );
}
