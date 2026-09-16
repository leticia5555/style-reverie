import { listContent, readContent } from "@/lib/content";
import { readCache, withRenderableImages, type Article } from "@/lib/editorial";
import type { Localized } from "@/lib/types";

/**
 * De dónde sale la foto de una tendencia.
 *
 * Tres fuentes, en este orden, y ninguna más:
 *
 *  1. La curada a mano en `content/trends/<slug>.json`. Manda siempre: si
 *     alguien eligió una foto, es la que se pone.
 *  2. La del artículo más reciente que menciona la tendencia. Ya viene en el
 *     caché del feed, ya pasó el filtro de hosts permitidos y ya trae su
 *     enlace al original.
 *  3. Nada. Entonces se pinta un pastel con el nombre, que es honesto: no
 *     tenemos foto de esto.
 *
 * **Nunca se bajan imágenes de Pinterest ni de Google Imágenes.** Solo de
 * fuentes que las publican para ser usadas: el medio que las sirve en su
 * propio feed, o una elegida a mano con su crédito. El crédito y el enlace al
 * original viajan con la imagen y se pintan siempre — una foto sin crédito no
 * se enseña.
 */

const CONTENT_FOLDER = "trends";

export type CuratedTrendImage = {
  /** URL de la imagen. El host tiene que estar en IMAGE_HOSTS. */
  imageUrl: string;
  /** A quién se le acredita. Va visible sobre la foto. */
  credit: string;
  /** Enlace al original. Obligatorio: sin él la foto no se enseña. */
  creditUrl: string;
  /** Texto alternativo, si el nombre de la tendencia no basta. */
  alt?: Localized;
};

export type TrendImage = {
  url: string;
  credit: string;
  creditUrl: string;
  /** Para poder auditar de dónde salió cada foto de la página. */
  from: "curated" | "editorial";
  alt?: Localized;
};

/** Los slugs con foto curada, para poder listarlos en un test. */
export function curatedSlugs(): string[] {
  return listContent(CONTENT_FOLDER);
}

export function curatedImage(trendId: string): CuratedTrendImage | null {
  const file = readContent<CuratedTrendImage>(CONTENT_FOLDER, trendId);
  if (!file?.imageUrl || !file.credit || !file.creditUrl) return null;
  return file;
}

/**
 * El artículo más reciente que menciona la tendencia y trae foto utilizable.
 *
 * `withRenderableImages` ya anuló las de hosts que next/image no puede cargar,
 * así que lo que quede aquí se puede pintar sin que reviente la página.
 */
export function editorialImage(
  trendId: string,
  articles: Article[],
): TrendImage | null {
  const candidates = articles
    .filter(
      (article) =>
        article.imageUrl &&
        article.matches.some((match) => match.trendId === trendId),
    )
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const article = candidates[0];
  if (!article?.imageUrl) return null;

  return {
    url: article.imageUrl,
    credit: article.sourceName,
    creditUrl: article.link,
    from: "editorial",
  };
}

export function resolveTrendImage(
  trendId: string,
  articles: Article[],
): TrendImage | null {
  const curated = curatedImage(trendId);
  if (curated) {
    return {
      url: curated.imageUrl,
      credit: curated.credit,
      creditUrl: curated.creditUrl,
      from: "curated",
      ...(curated.alt ? { alt: curated.alt } : {}),
    };
  }
  return editorialImage(trendId, articles);
}

/**
 * Resuelve varias de una vez leyendo el caché del feed una sola vez.
 *
 * Lo llaman los componentes de servidor y pasan el resultado como prop: este
 * módulo lee del disco y arrastrarlo a un componente cliente metería node:fs
 * en el bundle del navegador.
 */
export function trendImages(trendIds: string[]): Map<string, TrendImage> {
  const { articles } = withRenderableImages(readCache());
  const resolved = new Map<string, TrendImage>();

  for (const id of trendIds) {
    const image = resolveTrendImage(id, articles);
    if (image) resolved.set(id, image);
  }
  return resolved;
}
