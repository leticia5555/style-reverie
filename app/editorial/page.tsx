import { EditorialView } from "@/components/EditorialView";
import {
  getEditorial,
  trendMentions,
  withRenderableImages,
} from "@/lib/editorial";
import { editorialInsight } from "@/lib/insights";
import { getTrends } from "@/lib/trends";

export const metadata = {
  title: "Feed editorial — Style Reverie",
};

/**
 * El caché en disco ya limita el refresco a una vez por hora; esto evita
 * además que cada visita vuelva a leerlo y a re-renderizar.
 */
export const revalidate = 3600;

export default async function EditorialPage() {
  const cache = withRenderableImages(await getEditorial());
  const trends = getTrends();
  const names = new Map(trends.map((trend) => [trend.id, trend.name]));

  const mentions = trendMentions(cache.articles).map((row) => ({
    ...row,
    name: names.get(row.trendId) ?? { es: row.trendId, en: row.trendId },
  }));

  return (
    <EditorialView
      cache={cache}
      mentions={mentions}
      names={[...names.entries()]}
      insight={editorialInsight(
        cache.articles.length,
        cache.articles.filter((article) => article.matches.length).length,
        mentions,
        cache.feeds.filter((feed) => feed.ok).length,
        cache.feeds.length,
      )}
    />
  );
}
