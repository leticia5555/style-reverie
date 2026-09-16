import type { Db } from "@/lib/db/client";
import { SOURCES, type SignalPoint, type SourceKey, type Trend } from "@/lib/types";

/**
 * Lectura y escritura del catálogo en Postgres.
 *
 * El contrato es que una tendencia leída de la base produce exactamente los
 * mismos scores que la misma tendencia leída del seed. Por eso los valores van
 * en numeric y se parsean explícitamente: el driver devuelve numeric como
 * string para no perder precisión, y tratarlo como número sin más lo rompería.
 */
const num = (value: unknown): number =>
  typeof value === "number" ? value : Number(value);

type TrendRow = {
  id: string;
  name_es: string;
  name_en: string;
  category: string;
  season: string;
  summary_es: string;
  summary_en: string;
  score_year_ago: string | number;
  keywords: string[];
  swatch: string | null;
  shopping: Trend["shopping"];
};

type SignalRow = {
  trend_id: string;
  source: string;
  date: string | Date;
  value: string | number;
  origin: "mock" | "real";
};

const isoDate = (value: string | Date): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/** Origen de cada día de una tendencia, para marcar el corte mock→real. */
export type OriginByDate = Map<string, "mock" | "real">;

export type DbCatalog = {
  trends: Trend[];
  /** trendId → (fecha → origen). Lo consume la UI para atenuar lo mock. */
  origins: Map<string, OriginByDate>;
};

export async function loadCatalogFromDb(db: Db): Promise<DbCatalog | null> {
  const trendRows = await db.query<TrendRow>(
    `select id, name_es, name_en, category, season, summary_es, summary_en,
            score_year_ago, keywords, swatch, shopping
       from trends
      order by id`,
  );
  if (!trendRows.length) return null;

  const signalRows = await db.query<SignalRow>(
    `select trend_id, source, date, value, origin
       from signals
      order by trend_id, date`,
  );
  if (!signalRows.length) return null;

  // Agrupa las señales por tendencia y día; cada día trae sus seis fuentes.
  const byTrend = new Map<string, Map<string, SignalPoint>>();
  const origins = new Map<string, OriginByDate>();

  for (const row of signalRows) {
    const date = isoDate(row.date);
    let days = byTrend.get(row.trend_id);
    if (!days) {
      days = new Map();
      byTrend.set(row.trend_id, days);
    }
    let point = days.get(date);
    if (!point) {
      point = { date, signals: {} as Record<SourceKey, number> };
      days.set(date, point);
    }
    point.signals[row.source as SourceKey] = num(row.value);

    let dayOrigins = origins.get(row.trend_id);
    if (!dayOrigins) {
      dayOrigins = new Map();
      origins.set(row.trend_id, dayOrigins);
    }
    // Un día es "real" solo si todas sus fuentes lo son.
    const previous = dayOrigins.get(date);
    dayOrigins.set(
      date,
      previous === "mock" || row.origin === "mock" ? "mock" : "real",
    );
  }

  const trends: Trend[] = [];
  for (const row of trendRows) {
    const days = byTrend.get(row.id);
    if (!days) continue;

    const history = [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      // Un día incompleto rompería el promedio ponderado: se descarta.
      .filter((point) => SOURCES.every((source) => source in point.signals));
    if (!history.length) continue;

    trends.push({
      id: row.id,
      name: { es: row.name_es, en: row.name_en },
      category: row.category as Trend["category"],
      season: row.season as Trend["season"],
      summary: { es: row.summary_es, en: row.summary_en },
      history,
      scoreYearAgo: num(row.score_year_ago),
      keywords: row.keywords ?? [],
      ...(row.swatch ? { swatch: row.swatch } : {}),
      shopping: row.shopping,
    });
  }

  return trends.length ? { trends, origins } : null;
}

/**
 * Escribe el catálogo. Idempotente por (trend_id, source, date): correrlo dos
 * veces deja la base igual, que es lo que necesita el cron.
 */
export async function saveCatalogToDb(
  db: Db,
  trends: Trend[],
  origin: "mock" | "real",
): Promise<number> {
  for (const trend of trends) {
    await db.query(
      `insert into trends (id, name_es, name_en, category, season,
                           summary_es, summary_en, score_year_ago, keywords,
                           swatch, shopping, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       on conflict (id) do update set
         name_es = excluded.name_es, name_en = excluded.name_en,
         category = excluded.category, season = excluded.season,
         summary_es = excluded.summary_es, summary_en = excluded.summary_en,
         score_year_ago = excluded.score_year_ago,
         keywords = excluded.keywords, swatch = excluded.swatch,
         shopping = excluded.shopping, updated_at = now()`,
      [
        trend.id,
        trend.name.es,
        trend.name.en,
        trend.category,
        trend.season,
        trend.summary.es,
        trend.summary.en,
        trend.scoreYearAgo,
        trend.keywords,
        trend.swatch ?? null,
        JSON.stringify(trend.shopping),
      ],
    );
  }

  let written = 0;
  for (const trend of trends) {
    for (const point of trend.history) {
      for (const source of SOURCES) {
        await db.query(
          `insert into signals (trend_id, source, date, value, origin)
           values ($1,$2,$3,$4,$5)
           on conflict (trend_id, source, date) do update set
             value = excluded.value, origin = excluded.origin`,
          [trend.id, source, point.date, point.signals[source], origin],
        );
        written += 1;
      }
    }
  }
  return written;
}
