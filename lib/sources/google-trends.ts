import type { Db } from "@/lib/db/client";
import {
  normalizeToScale,
  type CollectResult,
  type Connector,
  type Reading,
} from "@/lib/sources/types";
import type { Trend } from "@/lib/types";

/**
 * Google Trends, región México.
 *
 * No hay API oficial: google-trends-api raspa el endpoint público, así que hay
 * que tratarlo como frágil. Tres defensas:
 *
 *  - Una consulta por tendencia y día como máximo. La propia tabla signals
 *    hace de caché: si ya hay un valor de hoy para esa tendencia, no se
 *    vuelve a preguntar. Esto también hace el cron idempotente ante reintentos.
 *  - Backoff exponencial con jitter entre reintentos, y pausa entre tendencias.
 *  - Un fallo por tendencia no aborta al resto; si fallan todas, el conector
 *    devuelve error y el cron sigue con las demás fuentes.
 */
export const GOOGLE_TRENDS_SOURCE = "google_trends";
const GEO = "MX";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;
const BETWEEN_QUERIES_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera creciente con jitter, para no golpear en ráfaga tras un bloqueo. */
export function backoffDelay(attempt: number, base = BASE_BACKOFF_MS): number {
  const exponential = base * 2 ** attempt;
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

/** Tendencias que hoy todavía no tienen valor de Google en la base. */
export async function pendingTrends(
  db: Db,
  trends: Trend[],
  date: string,
): Promise<Trend[]> {
  const rows = await db.query<{ trend_id: string }>(
    `select trend_id from signals
      where source = $1 and date = $2 and origin = 'real'`,
    [GOOGLE_TRENDS_SOURCE, date],
  );
  const done = new Set(rows.map((row) => row.trend_id));
  return trends.filter((trend) => !done.has(trend.id));
}

type InterestPoint = { value: number[] };

/** Media del interés de los últimos días que devuelve Google para el término. */
export function averageInterest(payload: string): number | null {
  try {
    const parsed = JSON.parse(payload) as {
      default?: { timelineData?: InterestPoint[] };
    };
    const timeline = parsed.default?.timelineData ?? [];
    if (!timeline.length) return null;

    const values = timeline
      .map((point) => point.value?.[0])
      .filter((value): value is number => typeof value === "number");
    if (!values.length) return null;

    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch {
    return null;
  }
}

async function interestOverTime(keyword: string): Promise<number | null> {
  // Import dinámico: el paquete no tiene tipos y solo se carga si se usa.
  const imported = (await import("google-trends-api")) as unknown as {
    default?: { interestOverTime: (options: object) => Promise<string> };
    interestOverTime?: (options: object) => Promise<string>;
  };
  const api = imported.default ?? imported;
  if (!api.interestOverTime) throw new Error("google-trends-api sin interestOverTime");

  const startTime = new Date();
  startTime.setUTCDate(startTime.getUTCDate() - 7);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const payload = await api.interestOverTime({ keyword, geo: GEO, startTime });
      return averageInterest(payload);
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(backoffDelay(attempt));
    }
  }
  return null;
}

export const googleTrendsConnector: Connector = {
  key: GOOGLE_TRENDS_SOURCE,

  async collect({ db, trends, date }): Promise<CollectResult> {
    const pending = await pendingTrends(db, trends, date);
    if (!pending.length) {
      return { status: "skipped", reason: "todas las tendencias ya tienen valor de hoy" };
    }

    const raw = new Map<string, number>();
    const failures: string[] = [];

    for (const trend of pending) {
      // El término de búsqueda en español: es lo que se busca en México.
      const keyword = trend.keywords[0] ?? trend.name.es;
      try {
        const value = await interestOverTime(keyword);
        if (value !== null) raw.set(trend.id, value);
      } catch (error) {
        failures.push(
          `${trend.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
      await sleep(BETWEEN_QUERIES_MS);
    }

    if (!raw.size) {
      return {
        status: "error",
        reason: failures.length
          ? `ninguna consulta respondió (${failures.length} fallos): ${failures[0]}`
          : "ninguna consulta devolvió datos",
      };
    }

    const readings: Reading[] = [...normalizeToScale(raw)].map(
      ([trendId, value]) => ({
        trendId,
        source: GOOGLE_TRENDS_SOURCE,
        date,
        value,
      }),
    );

    return { status: "ok", readings };
  },
};
