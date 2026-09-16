import { FashionWeekIndex } from "@/components/FashionWeekIndex";
import { listCollections } from "@/lib/fashion-week";

export const metadata = { title: "Fashion Week — Style Reverie" };

export default function FashionWeekPage() {
  return <FashionWeekIndex collections={listCollections()} />;
}
