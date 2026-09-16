import { FashionWeekIndex } from "@/components/FashionWeekIndex";
import { listCollections } from "@/lib/fashion-week";
import { fashionWeekInsight } from "@/lib/insights";

export const metadata = { title: "Fashion Week — Style Reverie" };

export default function FashionWeekPage() {
  const collections = listCollections();
  return (
    <FashionWeekIndex
      collections={collections}
      insight={fashionWeekInsight(collections)}
    />
  );
}
