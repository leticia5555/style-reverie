import { CompareView } from "@/components/CompareView";
import { compareInsight } from "@/lib/insights";
import {
  defaultComparePair,
  getComparison,
  getTrendSummaries,
} from "@/lib/trends";

export const metadata = {
  title: "Comparador — Style Reverie",
};

/**
 * La pareja vive en la URL (?a=&b=) para que una comparación se pueda mandar
 * por mensaje. Si un id no existe se cae al default en vez de dar 404: el
 * enlace sigue siendo útil aunque venga mal escrito.
 */
export default async function ComparePage({
  searchParams,
}: PageProps<"/compare">) {
  const params = await searchParams;
  const fallback = defaultComparePair();
  const read = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const comparison =
    getComparison(read(params.a) ?? fallback.a, read(params.b) ?? fallback.b) ??
    getComparison(fallback.a, fallback.b)!;

  const options = getTrendSummaries().map(({ id, name, category, score }) => ({
    id,
    name,
    category,
    score,
  }));

  return (
    <CompareView
      comparison={comparison}
      options={options}
      insight={compareInsight(
        comparison.a.summary,
        comparison.b.summary,
        comparison.series,
      )}
    />
  );
}
