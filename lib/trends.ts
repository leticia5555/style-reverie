import seed from "@/data/trends.seed.json";
import { deriveLifecycle } from "@/lib/lifecycle";
import {
  activeSourceCount,
  computeScore,
  momentum,
  scoreSeries,
  sourceBreakdown,
  yoyChange,
  type SourceBreakdownRow,
} from "@/lib/scoring";
import type { Trend, TrendSeed, TrendSummary } from "@/lib/types";

const data = seed as unknown as TrendSeed;

export const SEED_META = data.meta;

export function getTrends(): Trend[] {
  return data.trends;
}

export function getTrendById(id: string): Trend | undefined {
  return data.trends.find((trend) => trend.id === id);
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
  const score = computeScore(today.signals);
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
    spark: sparkline(scoreSeries(trend.history)),
  };
}

/** Filas de /trending, ordenadas por score descendente. */
export function getTrendSummaries(): TrendSummary[] {
  return getTrends()
    .map(toSummary)
    .sort((a, b) => b.score - a.score);
}

export type TrendDetail = {
  summary: TrendSummary;
  description: Trend["summary"];
  shopping: Trend["shopping"];
  series: { date: string; score: number }[];
  breakdown: SourceBreakdownRow[];
  high: number;
  low: number;
};

export function getTrendDetail(id: string): TrendDetail | undefined {
  const trend = getTrendById(id);
  if (!trend) return undefined;

  const series = scoreSeries(trend.history);

  return {
    summary: toSummary(trend),
    description: trend.summary,
    shopping: trend.shopping,
    series: trend.history.map((point, index) => ({
      date: point.date,
      score: series[index],
    })),
    breakdown: sourceBreakdown(trend),
    high: Math.max(...series),
    low: Math.min(...series),
  };
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
export function getComparison(aId: string, bId: string): Comparison | undefined {
  const a = getTrendById(aId);
  const b = getTrendById(bId);
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
export function defaultComparePair(): { a: string; b: string } {
  const rows = getTrendSummaries();
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

export function getAlerts(): Alert[] {
  return getTrends()
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
