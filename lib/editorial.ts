import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Parser from "rss-parser";
import { matchTrends, type TrendMatch } from "@/lib/editorial-match";
import {
  imageFromItem,
  isAllowedImageHost,
  ogImageFrom,
  type RssItemImageFields,
} from "@/lib/editorial-image";
import type { KeywordLang } from "@/lib/keyword-lang";
import { getTrends } from "@/lib/trends";

type Feed = {
  key: string;
  name: string;
  /** Idioma de la fuente, no del catálogo: decide contra qué términos cruza. */
  lang: KeywordLang;
  url: string;
};

/**
 * Las fuentes del feed, con su idioma. El idioma no es decorativo: el matcher
 * cruza cada titular contra los términos de ESE idioma, así que marcarlo mal
 * hace que la fuente deje de cruzar.
 *
 * Business of Fashion salió: no publica RSS y cada corrida se comía los 10s
 * de timeout para nada. En su lugar entraron las cabeceras mexicanas y
 * Fashionista, que sí son el mercado que mira esta app.
 *
 * Elle México salió después: la primera corrida real la dio por "sin
 * respuesta" y no se le encontró un RSS publicado en ninguna ruta conocida.
 * Una fuente que no responde no es gratis —cuesta su timeout en cada corrida—
 * así que se quita hasta tener una URL que alguien haya visto funcionar.
 */
export const FEEDS = [
  {
    key: "vogue-mx",
    name: "Vogue México",
    lang: "es",
    url: process.env.SR_FEED_VOGUE_MX ?? "https://www.vogue.mx/feed/rss",
  },
  {
    key: "glamour-mx",
    name: "Glamour México",
    lang: "es",
    url: process.env.SR_FEED_GLAMOUR_MX ?? "https://www.glamour.mx/feed/rss",
  },
  {
    key: "bazaar",
    name: "Harper's Bazaar",
    lang: "en",
    url:
      process.env.SR_FEED_BAZAAR ??
      "https://www.harpersbazaar.com/rss/all.xml/",
  },
  {
    key: "fashionista",
    name: "Fashionista",
    lang: "en",
    url: process.env.SR_FEED_FASHIONISTA ?? "https://fashionista.com/.rss/full/",
  },
  {
    key: "vogue",
    name: "Vogue",
    lang: "en",
    url: process.env.SR_FEED_VOGUE ?? "https://www.vogue.com/feed/rss",
  },
  {
    key: "wwd",
    name: "WWD",
    lang: "en",
    url: process.env.SR_FEED_WWD ?? "https://wwd.com/feed/",
  },
  {
    key: "whowhatwear",
    name: "Who What Wear",
    lang: "en",
    url: process.env.SR_FEED_WWW ?? "https://www.whowhatwear.com/rss",
  },
] as const satisfies readonly Feed[];

export type FeedKey = (typeof FEEDS)[number]["key"];

export type Article = {
  id: string;
  title: string;
  link: string;
  source: FeedKey;
  sourceName: string;
  /** Idioma de la fuente que lo publicó. */
  lang: KeywordLang;
  publishedAt: string | null;
  snippet: string;
  matches: TrendMatch[];
  /** null = el feed no traía imagen y la página pinta el placeholder. */
  imageUrl: string | null;
  /** De dónde salió la imagen, para poder depurar el feed. */
  imageFrom: "feed" | "og" | null;
};

export type FeedStatus = {
  key: FeedKey;
  name: string;
  lang: KeywordLang;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
};

export type EditorialCache = {
  fetchedAt: string | null;
  articles: Article[];
  feeds: FeedStatus[];
};

/** Máximo un refresco por hora, como pide el producto. */
export const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_PER_FEED = 20;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Pedir el og:image significa descargar el artículo entero, así que se acota:
 * solo para los que el feed dejó sin imagen, en tandas pequeñas y con tope por
 * refresco. Lo que ya se resolvió antes se reusa del caché y no se vuelve a
 * pedir nunca.
 */
const OG_TIMEOUT_MS = 6_000;
const OG_MAX_PER_REFRESH = 12;
const OG_CONCURRENCY = 4;
const OG_MAX_BYTES = 512 * 1024;

const REPO_CACHE = resolve(process.cwd(), "data/editorial.cache.json");
/**
 * En Vercel el repo es de solo lectura, así que el refresco escribe en el
 * directorio temporal. El JSON versionado sirve de punto de partida y de
 * respaldo cuando las fuentes no responden.
 */
const RUNTIME_CACHE = join(tmpdir(), "style-reverie-editorial.json");

const EMPTY: EditorialCache = { fetchedAt: null, articles: [], feeds: [] };

const FEED_BY_KEY = new Map<string, Feed>(FEEDS.map((feed) => [feed.key, feed]));

/**
 * El caché en disco sobrevive a los cambios de la lista de fuentes, así que
 * al leerlo se descartan los artículos de una fuente ya retirada y se rellena
 * el idioma de los que se guardaron antes de que existiera el campo.
 */
function adoptArticles(articles: Article[]): Article[] {
  const adopted: Article[] = [];
  for (const article of articles) {
    const feed = FEED_BY_KEY.get(article.source);
    if (!feed) continue;
    adopted.push(article.lang ? article : { ...article, lang: feed.lang });
  }
  return adopted;
}

function readFrom(path: string): EditorialCache | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as EditorialCache;
    if (!Array.isArray(parsed.articles)) return null;
    return {
      ...parsed,
      articles: adoptArticles(parsed.articles),
      feeds: (parsed.feeds ?? []).filter((feed) => FEED_BY_KEY.has(feed.key)),
    };
  } catch {
    return null;
  }
}

/** El más reciente entre el caché de runtime y el versionado. */
export function readCache(): EditorialCache {
  const runtime = readFrom(RUNTIME_CACHE);
  const repo = readFrom(REPO_CACHE);
  if (!runtime) return repo ?? EMPTY;
  if (!repo) return runtime;
  const rt = Date.parse(runtime.fetchedAt ?? "") || 0;
  const rp = Date.parse(repo.fetchedAt ?? "") || 0;
  return rt >= rp ? runtime : repo;
}

export function isStale(cache: EditorialCache, now = Date.now()): boolean {
  if (!cache.fetchedAt) return true;
  const at = Date.parse(cache.fetchedAt);
  return Number.isNaN(at) || now - at >= CACHE_TTL_MS;
}

function writeCache(cache: EditorialCache, toRepo: boolean): void {
  const payload = `${JSON.stringify(cache, null, 2)}\n`;
  try {
    writeFileSync(toRepo ? REPO_CACHE : RUNTIME_CACHE, payload, "utf8");
  } catch {
    // Sistema de archivos de solo lectura: el caché vive en memoria este ciclo.
  }
}

/** Id estable por enlace: el mismo artículo no se duplica entre refrescos. */
function articleId(link: string, title: string): string {
  return createHash("sha1").update(`${link}|${title}`).digest("hex").slice(0, 12);
}

function clean(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Descarga la portada de un artículo y saca su og:image. */
async function fetchOgImage(link: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);
    const response = await fetch(link, {
      signal: controller.signal,
      headers: { "user-agent": "StyleReverie/0.1 (+editorial feed reader)" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    // No hace falta el documento entero: og:image vive en el <head>.
    const html = (await response.text()).slice(0, OG_MAX_BYTES);
    return ogImageFrom(html);
  } catch {
    return null;
  }
}

/**
 * Completa las imágenes que faltan. Primero reusa lo que ya estaba en el
 * caché — por eso la imagen se guarda junto al item — y solo sale a la red
 * por los artículos nuevos que siguen sin nada.
 */
async function fillMissingImages(
  articles: Article[],
  previous: Article[],
): Promise<void> {
  const known = new Map(
    previous
      .filter((article) => article.imageUrl)
      .map((article) => [article.id, article]),
  );

  const pending: Article[] = [];
  for (const article of articles) {
    if (article.imageUrl) continue;
    const cached = known.get(article.id);
    if (cached?.imageUrl) {
      article.imageUrl = cached.imageUrl;
      article.imageFrom = cached.imageFrom;
      continue;
    }
    pending.push(article);
  }

  const queue = pending.slice(0, OG_MAX_PER_REFRESH);
  for (let i = 0; i < queue.length; i += OG_CONCURRENCY) {
    const batch = queue.slice(i, i + OG_CONCURRENCY);
    await Promise.all(
      batch.map(async (article) => {
        const found = await fetchOgImage(article.link);
        if (found) {
          article.imageUrl = found;
          article.imageFrom = "og";
        }
      }),
    );
  }
}

async function fetchFeed(
  feed: (typeof FEEDS)[number],
  parser: Parser,
): Promise<{ status: FeedStatus; articles: Article[] }> {
  const trends = getTrends().map(({ id, keywords }) => ({ id, keywords }));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "user-agent": "StyleReverie/0.1 (+editorial feed reader)" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = await parser.parseString(await response.text());
    const articles = (parsed.items ?? [])
      .slice(0, MAX_PER_FEED)
      .map((item) => {
        const title = clean(item.title);
        const link = item.link?.trim() ?? "";
        const snippet = clean(item.contentSnippet ?? item.content).slice(0, 280);
        const published = item.isoDate ?? item.pubDate ?? null;
        const fromFeed = imageFromItem(item as RssItemImageFields);
        return {
          id: articleId(link, title),
          title,
          link,
          source: feed.key,
          sourceName: feed.name,
          lang: feed.lang,
          publishedAt: published ? new Date(published).toISOString() : null,
          snippet,
          matches: matchTrends(`${title} ${snippet}`, trends, feed.lang),
          imageUrl: fromFeed,
          imageFrom: fromFeed ? ("feed" as const) : null,
        };
      })
      .filter((article) => article.title && article.link);

    return {
      status: {
        key: feed.key,
        name: feed.name,
        lang: feed.lang,
        url: feed.url,
        ok: true,
        count: articles.length,
      },
      articles,
    };
  } catch (error) {
    return {
      status: {
        key: feed.key,
        name: feed.name,
        lang: feed.lang,
        url: feed.url,
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : String(error),
      },
      articles: [],
    };
  }
}

/**
 * Trae todas las fuentes en paralelo. Una fuente caída no tumba al resto: su
 * error se guarda en el estado y la página lo muestra.
 */
export async function refreshEditorial({
  toRepo = false,
}: { toRepo?: boolean } = {}): Promise<EditorialCache> {
  // rss-parser ignora los campos que no conoce: hay que pedirlos por nombre.
  const parser = new Parser({
    customFields: {
      item: [
        ["media:content", "mediaContent", { keepArray: true }],
        ["media:thumbnail", "mediaThumbnail"],
        ["content:encoded", "contentEncoded"],
      ],
    },
  });
  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed, parser)));

  const articles = results
    .flatMap((result) => result.articles)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const previous = readCache();
  await fillMissingImages(articles, previous.articles);
  const anyOk = results.some((result) => result.status.ok);

  // Si ninguna fuente respondió, se conserva lo último bueno que había.
  const cache: EditorialCache = {
    fetchedAt: new Date().toISOString(),
    articles: anyOk ? articles : previous.articles,
    feeds: results.map((result) => result.status),
  };

  writeCache(cache, toRepo);
  return cache;
}

/** Lo que consume la página: caché si está fresco, refresco si no. */
export async function getEditorial(): Promise<EditorialCache> {
  const cache = readCache();
  if (!isStale(cache)) return cache;
  return refreshEditorial();
}

/**
 * Anula las imágenes que next/image no puede cargar. La decisión se toma en el
 * servidor a propósito: la lista de hosts depende de env y el cliente no la ve,
 * así que comprobarla al renderizar daba un desajuste de hidratación. El caché
 * conserva la URL original para poder depurar qué CDN quedó fuera.
 */
export function withRenderableImages(cache: EditorialCache): EditorialCache {
  return {
    ...cache,
    articles: cache.articles.map((article) =>
      article.imageUrl && !isAllowedImageHost(article.imageUrl)
        ? { ...article, imageUrl: null, imageFrom: null }
        : article,
    ),
  };
}

/** Artículos agrupados por tendencia mencionada, para el panel lateral. */
export function trendMentions(
  articles: Article[],
): { trendId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const match of article.matches) {
      counts.set(match.trendId, (counts.get(match.trendId) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([trendId, count]) => ({ trendId, count }))
    .sort((a, b) => b.count - a.count);
}
