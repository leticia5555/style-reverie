import type { Db } from "@/lib/db/client";
import {
  normalizeToScale,
  type CollectResult,
  type Connector,
  type ConnectorTrend,
  type Reading,
} from "@/lib/sources/types";


/**
 * Google Trends, región México.
 *
 * No hay API oficial: google-trends-api raspa el endpoint público, así que hay
 * que tratarlo como hostil. La primera corrida real lo dejó claro — devolvió
 * 429 y unas diez llamadas se quedaron colgadas 42.9s cada una hasta morir por
 * el timeout global de la función. Las defensas salen de ese diagnóstico:
 *
 *  - Como mucho CINCO tendencias por corrida, las más desactualizadas primero.
 *    Rotando así, en cinco días se cubren las 25 y ninguna se queda atrás.
 *  - Timeout propio de 15s por consulta. El paquete no lo expone, así que se
 *    corre contra un reloj: sin esto una llamada colgada se come la corrida
 *    entera y arrastra a las demás fuentes.
 *  - Entre 5 y 10 segundos de espera entre consultas. En ráfaga se gana el 429
 *    con seguridad.
 *  - Un 429 aborta la fuente completa. Reintentar tras un 429 es lo que
 *    convierte un bloqueo de un minuto en uno de una hora.
 */
export const GOOGLE_TRENDS_SOURCE = "google_trends";
const GEO = "MX";

/** Tope por corrida. Con 25 tendencias, el catálogo se cubre en cinco días. */
export const MAX_PER_RUN = 5;
const QUERY_TIMEOUT_MS = 15_000;
const MIN_GAP_MS = 5_000;
const MAX_GAP_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera creciente con jitter, para no golpear en ráfaga tras un fallo. */
export function backoffDelay(attempt: number, base = BASE_BACKOFF_MS): number {
  const exponential = base * 2 ** attempt;
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

/** Pausa aleatoria entre consultas: un ritmo fijo también se detecta. */
export function gapDelay(): number {
  return Math.round(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
}

/** Un 429 es un "para", no un "reintenta". */
export function isRateLimited(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /\b429\b|too many requests|rate.?limit/i.test(text);
}

export class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/** Corre una promesa contra un reloj; si no llega, se abandona. */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}: timeout tras ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Tendencias por orden de necesidad: primero las que nunca se han consultado,
 * después las que llevan más tiempo sin actualizarse. Así la rotación es
 * determinista y ninguna se queda sin turno.
 */
export async function staleTrends(
  db: Db,
  trends: ConnectorTrend[],
  date: string,
  limit = MAX_PER_RUN,
): Promise<ConnectorTrend[]> {
  const rows = await db.query<{ trend_id: string; last: string | Date | null }>(
    `select trend_id, max(date) as last
       from signals
      where source = $1 and origin = 'real'
      group by trend_id`,
    [GOOGLE_TRENDS_SOURCE],
  );

  const lastSeen = new Map(
    rows.map((row) => [
      row.trend_id,
      row.last instanceof Date
        ? row.last.toISOString().slice(0, 10)
        : row.last
          ? String(row.last).slice(0, 10)
          : "",
    ]),
  );

  return trends
    // Lo de hoy ya está hecho: no se vuelve a pedir.
    .filter((trend) => lastSeen.get(trend.id) !== date)
    .sort((a, b) => {
      // "" (nunca consultada) ordena antes que cualquier fecha.
      const left = lastSeen.get(a.id) ?? "";
      const right = lastSeen.get(b.id) ?? "";
      return left.localeCompare(right) || a.id.localeCompare(b.id);
    })
    .slice(0, limit);
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
  if (!api.interestOverTime) {
    throw new Error("google-trends-api sin interestOverTime");
  }

  const startTime = new Date();
  startTime.setUTCDate(startTime.getUTCDate() - 7);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const payload = await withTimeout(
        api.interestOverTime({ keyword, geo: GEO, startTime }),
        QUERY_TIMEOUT_MS,
        keyword,
      );
      return averageInterest(payload);
    } catch (error) {
      // Un 429 sube tal cual: quien llama tiene que abortar la fuente entera,
      // no seguir insistiendo.
      if (isRateLimited(error)) {
        throw new RateLimitedError(
          error instanceof Error ? error.message : String(error),
        );
      }
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(backoffDelay(attempt));
    }
  }
  return null;
}

export const googleTrendsConnector: Connector = {
  key: GOOGLE_TRENDS_SOURCE,

  async collect({ db, trends, date }): Promise<CollectResult> {
    const pending = await staleTrends(db, trends, date);
    if (!pending.length) {
      return {
        status: "skipped",
        reason: "todas las tendencias ya tienen valor de hoy",
      };
    }

    const raw = new Map<string, number>();
    const failures: string[] = [];
    let rateLimited: string | null = null;

    for (const [index, trend] of pending.entries()) {
      // El término en español: es lo que se busca en México.
      const keyword = trend.keywords[0] ?? trend.name.es;
      try {
        const value = await interestOverTime(keyword);
        if (value !== null) raw.set(trend.id, value);
      } catch (error) {
        if (error instanceof RateLimitedError) {
          rateLimited = error.message;
          break;
        }
        failures.push(
          `${trend.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
      // Sin pausa después de la última: solo alarga la corrida.
      if (index < pending.length - 1) await sleep(gapDelay());
    }

    if (rateLimited) {
      // Lo que alcanzó a traerse antes del 429 se guarda igual: son datos
      // buenos y tirarlos obligaría a volver a pedirlos mañana.
      const partial = [...normalizeToScale(raw)].map(
        ([trendId, value]): Reading => ({
          trendId,
          source: GOOGLE_TRENDS_SOURCE,
          date,
          value,
        }),
      );
      if (partial.length) {
        return { status: "ok", readings: partial };
      }
      return {
        status: "error",
        reason: `Google devolvió 429, fuente abortada tras ${pending.length - 1} intentos: ${rateLimited}`,
      };
    }

    if (!raw.size) {
      return {
        status: "error",
        reason: failures.length
          ? `ninguna de las ${pending.length} consultas respondió: ${failures[0]}`
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
