import seed from "@/data/trends.seed.json";
import { forecast, type Forecast } from "@/lib/forecast";
import { deriveLifecycle } from "@/lib/lifecycle";
import {
  activeSourceCount,
  availableSourceCount,
  computeScore,
  momentum,
  scoreSeries,
  sourceBreakdown,
  yoyChange,
  type SourceBreakdownRow,
} from "@/lib/scoring";
import type {
  AccumulatingTrend,
  Trend,
  TrendSeed,
  TrendSummary,
} from "@/lib/types";

const data = seed as unknown as TrendSeed;

export const SEED_META = data.meta;

/**
 * El catálogo del seed. Es el fallback cuando la base no responde y el que
 * usan los tests: las funciones puras de este módulo lo toman por defecto, de
 * modo que se pueden llamar con el catálogo de Postgres sin cambiar nada más.
 */
export function getTrends(): Trend[] {
  return data.trends;
}

export function getTrendById(
  id: string,
  trends: Trend[] = data.trends,
): Trend | undefined {
  return trends.find((trend) => trend.id === id);
}

/** Muestra la serie de 90 días en 30 puntos para el sparkline de la tabla. */
function sparkline(series: number[], points = 30): number[] {
  const step = Math.max(1, Math.floor(series.length / points));
  const sampled = series.filter((_, index) => index % step === 0);
  const last = series[series.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export function toSummary(trend: Trend): TrendSummary {
  const today = trend.history[trend.history.length - 1];
  // El último día siempre trae alguna fuente: un día sin ninguna se descarta
  // al construir el catálogo, tanto desde el seed como desde la base.
  const score = computeScore(today.signals) ?? 0;
  const momentum7d = momentum(trend.history);

  return {
    id: trend.id,
    name: trend.name,
    category: trend.category,
    season: trend.season,
    score,
    lifecycle: deriveLifecycle(score, momentum7d),
    momentum7d,
    yoyPct: yoyChange(score, trend.scoreYearAgo),
    sourceCount: activeSourceCount(today.signals),
    sourceTotal: availableSourceCount(today.signals),
    spark: sparkline(scoreSeries(trend.history)),
  };
}

/** Filas de /trending, ordenadas por score descendente. */
export function getTrendSummaries(
  trends: Trend[] = data.trends,
): TrendSummary[] {
  return trends.map(toSummary).sort((a, b) => b.score - a.score);
}

export type TrendDetail = {
  summary: TrendSummary;
  description: Trend["summary"];
  shopping: Trend["shopping"];
  series: { date: string; score: number }[];
  breakdown: SourceBreakdownRow[];
  high: number;
  low: number;
  /** Proyección a 7 días. null si la serie es demasiado corta. */
  forecast: Forecast | null;
};

export function getTrendDetail(
  id: string,
  trends: Trend[] = data.trends,
): TrendDetail | undefined {
  const trend = getTrendById(id, trends);
  if (!trend) return undefined;

  const series = scoreSeries(trend.history);
  const points = trend.history.map((point, index) => ({
    date: point.date,
    score: series[index],
  }));

  return {
    summary: toSummary(trend),
    description: trend.summary,
    shopping: trend.shopping,
    series: points,
    breakdown: sourceBreakdown(trend),
    high: Math.max(...series),
    low: Math.min(...series),
    forecast: forecast(points),
  };
}

/**
 * El catálogo tal y como se veía en una fecha del histórico: corta la serie ahí
 * y recalcula. Lo usa el archivo de ediciones semanales, para que una edición
 * pasada muestre los scores de su semana y no los de hoy.
 *
 * La variación anual sí queda aproximada: scoreYearAgo es un único valor fijo
 * por tendencia, no una serie, así que se compara contra el mismo punto.
 */
export function summaryAsOf(trend: Trend, date: string): TrendSummary | undefined {
  const index = trend.history.findIndex((point) => point.date === date);
  if (index < 0) return undefined;
  return toSummary({ ...trend, history: trend.history.slice(0, index + 1) });
}

/** Todas las fechas del histórico, de la más antigua a la más reciente. */
export function historyDates(trends: Trend[] = data.trends): string[] {
  return trends[0].history.map((point) => point.date);
}

/* ── Comparador A vs B ─────────────────────────────────────────────── */

export type CompareSide = {
  summary: TrendSummary;
  description: Trend["summary"];
  breakdown: SourceBreakdownRow[];
};

export type Comparison = {
  a: CompareSide;
  b: CompareSide;
  /** Serie conjunta: ambas tendencias comparten el eje de fechas. */
  series: { date: string; a: number; b: number }[];
};

function toSide(trend: Trend): CompareSide {
  return {
    summary: toSummary(trend),
    description: trend.summary,
    breakdown: sourceBreakdown(trend),
  };
}

/**
 * Las 25 tendencias se generan con el mismo corte y los mismos 90 días, así que
 * las series se alinean por índice. Si algún día dejan de compartir calendario,
 * esto hay que cambiarlo por un join por fecha.
 */
export function getComparison(
  aId: string,
  bId: string,
  trends: Trend[] = data.trends,
): Comparison | undefined {
  const a = getTrendById(aId, trends);
  const b = getTrendById(bId, trends);
  if (!a || !b) return undefined;

  const seriesA = scoreSeries(a.history);
  const seriesB = scoreSeries(b.history);

  return {
    a: toSide(a),
    b: toSide(b),
    series: a.history.map((point, index) => ({
      date: point.date,
      a: seriesA[index],
      b: seriesB[index],
    })),
  };
}

/**
 * Pareja por default del comparador: la emergente con más momentum contra la
 * más saturada. Es la comparación que mejor explica el producto — lo que viene
 * contra lo que ya se agotó.
 */
export function defaultComparePair(trends: Trend[] = data.trends): {
  a: string;
  b: string;
} {
  const rows = getTrendSummaries(trends);
  const emerging = rows
    .filter((row) => row.lifecycle === "EMERGIENDO")
    .sort((x, y) => y.momentum7d - x.momentum7d)[0];
  const peak = rows.filter((row) => row.lifecycle === "PICO")[0];
  return {
    a: emerging?.id ?? rows[0].id,
    b: peak?.id ?? rows[1].id,
  };
}

/* ── Alertas de emergentes ─────────────────────────────────────────── */

/** Una tendencia entra en alerta si sube fuerte y todavía no es masiva. */
export const ALERT_MIN_MOMENTUM = 3;
export const ALERT_MAX_SCORE = 60;

export type Alert = TrendSummary & {
  /** Días consecutivos, hasta hoy, en que el score no ha retrocedido. */
  risingDays: number;
  /** Score de hace `risingDays` días. */
  scoreAtStart: number;
};

/**
 * Media móvil de 7 días. La señal diaria trae un ciclo semanal (la gente busca
 * distinto en sábado que en martes) y una ventana de 7 días lo cancela.
 */
function smooth(series: number[], window = 7): number[] {
  return series.map((_, index) => {
    const from = Math.max(0, index - window + 1);
    const slice = series.slice(from, index + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Cuenta hacia atrás desde hoy mientras la tendencia venga subiendo. Se mide
 * sobre la serie suavizada: sobre la serie cruda el ciclo semanal cortaría la
 * racha cada pocos días y el número no diría nada.
 */
export function countRisingDays(series: number[]): number {
  const curve = smooth(series);
  let days = 0;
  for (let i = curve.length - 1; i > 0; i -= 1) {
    if (curve[i] < curve[i - 1]) break;
    days += 1;
  }
  return days;
}

export function getAlerts(trends: Trend[] = data.trends): Alert[] {
  return trends
    .map((trend) => {
      const summary = toSummary(trend);
      const series = scoreSeries(trend.history);
      const risingDays = countRisingDays(series);
      return {
        ...summary,
        risingDays,
        scoreAtStart: series[Math.max(0, series.length - 1 - risingDays)],
      };
    })
    .filter(
      (row) =>
        row.momentum7d >= ALERT_MIN_MOMENTUM && row.score < ALERT_MAX_SCORE,
    )
    .sort((x, y) => y.momentum7d - x.momentum7d);
}

/* ── Catálogo desde Postgres, con fallback al seed ─────────────────── */

import { getDb } from "@/lib/db/client";
import { loadCatalogFromDb, type OriginByDate } from "@/lib/db/catalog";

export type Catalog = {
  trends: Trend[];
  /** Promovidas sin los 14 días de señal real; ver DbCatalog. */
  accumulating: AccumulatingTrend[];
  /** trendId → (fecha → origen). Vacío cuando se sirve el seed. */
  origins: Map<string, OriginByDate>;
  source: "db" | "seed";
};

let cachedCatalog: Catalog | null = null;

/**
 * El catálogo que consumen las páginas: Postgres si responde, seed si no.
 *
 * El fallback es silencioso a propósito —una base caída no puede tumbar la
 * app— pero no es invisible: `source` viaja en el resultado y la UI marca de
 * dónde salió el dato. Se cachea por proceso; en el build eso significa una
 * sola consulta para todas las páginas.
 */
export async function getCatalog(): Promise<Catalog> {
  if (cachedCatalog) return cachedCatalog;

  const db = getDb();
  if (db) {
    try {
      const loaded = await loadCatalogFromDb(db);
      if (loaded) {
        cachedCatalog = { ...loaded, source: "db" };
        return cachedCatalog;
      }
    } catch (error) {
      // Base caída o esquema sin migrar: se sirve el seed y se deja constancia.
      console.warn(
        "[catalog] Postgres no respondió, se usa el seed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  cachedCatalog = {
    trends: data.trends,
    // El seed no promueve nada: sin base, no hay tendencias acumulando.
    accumulating: [],
    origins: new Map(),
    source: "seed",
  };
  return cachedCatalog;
}

/** Para los tests: olvida el catálogo cacheado. */
export function resetCatalogCache(): void {
  cachedCatalog = null;
}
