import { collectionImages } from "@/lib/collection-image";
import { FashionWeekIndex } from "@/components/FashionWeekIndex";
import { listCollections } from "@/lib/fashion-week";
import { fashionWeekInsight } from "@/lib/insights";

export const metadata = { title: "Fashion Week — Style Reverie" };

export default async function FashionWeekPage() {
  const collections = listCollections();
  const images = await collectionImages(collections);

  return (
    <FashionWeekIndex
      images={images}
      collections={collections}
      insight={fashionWeekInsight(collections)}
    />
  );
}
