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
