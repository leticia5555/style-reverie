import type { Collection } from "@/lib/fashion-week";
import { trendImages, type TrendImage } from "@/lib/trend-image";

/**
 * La foto de una colección sale prestada de las tendencias que ella misma cita
 * en sus looks.
 *
 * No tenemos fotos de pasarela y no se bajan de donde no se puede: lo honesto
 * es usar la de una tendencia que la colección declara. Se recorren los looks
 * en orden y gana la primera tendencia que tenga foto, porque el primer look
 * con imagen es el que la colección pone por delante.
 */
export function collectionImages(
  collections: Collection[],
): Record<string, TrendImage> {
  const ids = [
    ...new Set(
      collections.flatMap((collection) =>
        collection.looks.flatMap((look) => look.trendIds ?? []),
      ),
    ),
  ];
  const byTrend = trendImages(ids);

  const result: Record<string, TrendImage> = {};
  for (const collection of collections) {
    for (const look of collection.looks) {
      const hit = (look.trendIds ?? []).find((id) => byTrend.has(id));
      if (hit) {
        result[collection.slug] = byTrend.get(hit)!;
        break;
      }
    }
  }
  return result;
}

/**
 * Lo mismo para las ocasiones: la foto sale de la primera de sus tendencias
 * que tenga una. El orden del archivo curado es el orden editorial, así que
 * la primera con foto es la que la ocasión pone por delante.
 */
export function ocasionImages(
  ocasiones: { slug: string; trends: { summary: { id: string } }[] }[],
): Record<string, TrendImage> {
  const ids = [
    ...new Set(
      ocasiones.flatMap((ocasion) =>
        ocasion.trends.map((trend) => trend.summary.id),
      ),
    ),
  ];
  const byTrend = trendImages(ids);

  const result: Record<string, TrendImage> = {};
  for (const ocasion of ocasiones) {
    const hit = ocasion.trends.find((trend) => byTrend.has(trend.summary.id));
    if (hit) result[ocasion.slug] = byTrend.get(hit.summary.id)!;
  }
  return result;
}
