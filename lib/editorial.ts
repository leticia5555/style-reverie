import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Parser from "rss-parser";
import { matchTrends, type TrendMatch } from "@/lib/editorial-match";
import { getTrends } from "@/lib/trends";

export const FEEDS = [
  { key: "vogue", name: "Vogue", url: process.env.SR_FEED_VOGUE ?? "https://www.vogue.com/feed/rss" },
  { key: "wwd", name: "WWD", url: process.env.SR_FEED_WWD ?? "https://wwd.com/feed/" },
  {
    key: "bof",
    name: "Business of Fashion",
    url:
      process.env.SR_FEED_BOF ??
      "https://www.businessoffashion.com/feeds/rss/",
  },
  {
    key: "whowhatwear",
    name: "Who What Wear",
    url: process.env.SR_FEED_WWW ?? "https://www.whowhatwear.com/rss",
  },
] as const;

export type FeedKey = (typeof FEEDS)[number]["key"];

export type Article = {
  id: string;
  title: string;
  link: string;
  source: FeedKey;
  sourceName: string;
  publishedAt: string | null;
  snippet: string;
  matches: TrendMatch[];
};

export type FeedStatus = {
  key: FeedKey;
  name: string;
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

const REPO_CACHE = resolve(process.cwd(), "data/editorial.cache.json");
/**
 * En Vercel el repo es de solo lectura, así que el refresco escribe en el
 * directorio temporal. El JSON versionado sirve de punto de partida y de
 * respaldo cuando las fuentes no responden.
 */
const RUNTIME_CACHE = join(tmpdir(), "style-reverie-editorial.json");

const EMPTY: EditorialCache = { fetchedAt: null, articles: [], feeds: [] };

function readFrom(path: string): EditorialCache | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as EditorialCache;
    return Array.isArray(parsed.articles) ? parsed : null;
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
        return {
          id: articleId(link, title),
          title,
          link,
          source: feed.key,
          sourceName: feed.name,
          publishedAt: published ? new Date(published).toISOString() : null,
          snippet,
          matches: matchTrends(`${title} ${snippet}`, trends),
        };
      })
      .filter((article) => article.title && article.link);

    return {
      status: {
        key: feed.key,
        name: feed.name,
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
 * Trae las cuatro fuentes en paralelo. Una fuente caída no tumba al resto: su
 * error se guarda en el estado y la página lo muestra.
 */
export async function refreshEditorial({
  toRepo = false,
}: { toRepo?: boolean } = {}): Promise<EditorialCache> {
  const parser = new Parser();
  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed, parser)));

  const articles = results
    .flatMap((result) => result.articles)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const previous = readCache();
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
