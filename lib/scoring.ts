import { SOURCES, type SignalPoint, type SourceKey, type Trend } from "@/lib/types";

/**
 * Pesos del score compuesto. Suman 1.
 * Búsqueda pesa más que social porque es intención, no exposición;
 * Amazon pesa menos porque va con retraso respecto al resto.
 */
export const SOURCE_WEIGHTS: Record<SourceKey, number> = {
  google_trends: 0.22,
  pinterest: 0.2,
  tiktok: 0.18,
  instagram: 0.15,
  editorial: 0.13,
  amazon: 0.12,
};

export const MOMENTUM_WINDOW_DAYS = 7;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Promedio ponderado de las señales de un día → score 0–100. */
export function computeScore(signals: Record<SourceKey, number>): number {
  const total = SOURCES.reduce(
    (acc, source) => acc + signals[source] * SOURCE_WEIGHTS[source],
    0,
  );
  return round1(Math.min(100, Math.max(0, total)));
}

/** Serie diaria de scores, del más antiguo al más reciente. */
export function scoreSeries(history: SignalPoint[]): number[] {
  return history.map((point) => computeScore(point.signals));
}

export function currentScore(history: SignalPoint[]): number {
  return computeScore(history[history.length - 1].signals);
}

/** Puntos de score ganados o perdidos en los últimos 7 días. */
export function momentum(
  history: SignalPoint[],
  windowDays = MOMENTUM_WINDOW_DAYS,
): number {
  const series = scoreSeries(history);
  const last = series[series.length - 1];
  const previous = series[Math.max(0, series.length - 1 - windowDays)];
  return round1(last - previous);
}

/** Variación porcentual contra el score de hace un año. */
export function yoyChange(score: number, scoreYearAgo: number): number {
  if (scoreYearAgo <= 0) return 0;
  return round1(((score - scoreYearAgo) / scoreYearAgo) * 100);
}

/** Cuántas fuentes están dando señal relevante hoy (>= 20). */
export function activeSourceCount(
  signals: Record<SourceKey, number>,
  threshold = 20,
): number {
  return SOURCES.filter((source) => signals[source] >= threshold).length;
}

export type SourceBreakdownRow = {
  source: SourceKey;
  value: number;
  weight: number;
  contribution: number;
  change7d: number;
};

/** Aporte de cada fuente al score de hoy. */
export function sourceBreakdown(trend: Trend): SourceBreakdownRow[] {
  const history = trend.history;
  const today = history[history.length - 1].signals;
  const past =
    history[Math.max(0, history.length - 1 - MOMENTUM_WINDOW_DAYS)].signals;

  return SOURCES.map((source) => ({
    source,
    value: round1(today[source]),
    weight: SOURCE_WEIGHTS[source],
    contribution: round1(today[source] * SOURCE_WEIGHTS[source]),
    change7d: round1(today[source] - past[source]),
  })).sort((a, b) => b.contribution - a.contribution);
}
