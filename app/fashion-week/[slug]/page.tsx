import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trendImages } from "@/lib/trend-image";
import { CollectionView } from "@/components/CollectionView";
import { collectionSlugs, getCollection } from "@/lib/fashion-week";

export function generateStaticParams() {
  return collectionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/fashion-week/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  return {
    title: collection
      ? `${collection.house} ${collection.season} — Style Reverie`
      : "Style Reverie",
    description: collection?.summary.es,
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/fashion-week/[slug]">) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const images = Object.fromEntries(
    await trendImages(collection.trends.map((trend) => trend.id)),
  );

  return <CollectionView collection={collection} images={images} />;
}
