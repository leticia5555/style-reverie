import {
  SOURCES,
  type SignalPoint,
  type Signals,
  type SourceKey,
  type Trend,
} from "@/lib/types";

/**
 * Pesos conceptuales del score. Suman 1 entre las siete fuentes.
 *
 * Mercado Libre pesa tanto como Google porque es la única señal de intención
 * de compra en México. Amazon baja porque va con retraso y no es local.
 */
export const SOURCE_WEIGHTS: Record<SourceKey, number> = {
  google_trends: 0.2,
  mercadolibre: 0.2,
  pinterest: 0.18,
  tiktok: 0.15,
  instagram: 0.1,
  editorial: 0.1,
  amazon: 0.07,
};

/**
 * Pinterest tiene peso conceptual pero NUNCA participa en el score.
 *
 * No se persiste —regla dura de CLAUDE.md— así que jamás hay un valor suyo
 * guardado que promediar. Su .18 existe para dejar dicho cuánto valdría, y
 * para que el día que se decida persistirlo el número ya esté pensado. Hasta
 * entonces, su peso se reparte solo entre las demás al renormalizar.
 */
export const NON_PARTICIPATING: readonly SourceKey[] = ["pinterest"];

export const PARTICIPATING_SOURCES = SOURCES.filter(
  (source) => !NON_PARTICIPATING.includes(source),
);

export const MOMENTUM_WINDOW_DAYS = 7;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Fuentes que participan y tienen valor ese día. */
export function presentSources(signals: Signals): SourceKey[] {
  return PARTICIPATING_SOURCES.filter(
    (source) => typeof signals[source] === "number",
  );
}

/**
 * Score del día: promedio ponderado SOLO de las fuentes que tienen valor, con
 * los pesos reescalados para sumar 1 entre ellas.
 *
 * Renormalizar es lo que permite que el score sobreviva a la realidad: una
 * fuente que todavía no existe, otra que se cae tres días, Pinterest que nunca
 * participa. Sin esto, cada hueco hundiría el score como si el mercado se
 * hubiera enfriado, cuando lo único que pasó es que faltó un dato.
 *
 * Un día sin ninguna fuente utilizable devuelve null: no es un cero.
 */
export function computeScore(signals: Signals): number | null {
  const present = presentSources(signals);
  if (!present.length) return null;

  const weightSum = present.reduce(
    (acc, source) => acc + SOURCE_WEIGHTS[source],
    0,
  );
  if (weightSum <= 0) return null;

  const total = present.reduce(
    (acc, source) => acc + signals[source]! * SOURCE_WEIGHTS[source],
    0,
  );
  return round1(Math.min(100, Math.max(0, total / weightSum)));
}

/** Como computeScore pero para cuando el día se sabe utilizable. */
function scoreOrZero(signals: Signals): number {
  return computeScore(signals) ?? 0;
}

/** Serie diaria de scores, del más antiguo al más reciente. */
export function scoreSeries(history: SignalPoint[]): number[] {
  return history.map((point) => scoreOrZero(point.signals));
}

export function currentScore(history: SignalPoint[]): number {
  return scoreOrZero(history[history.length - 1].signals);
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

/**
 * Fuentes que hoy confirman la tendencia: las que participan, tienen valor y
 * superan el umbral. Una emergente suele tener dos o tres; una saturada, todas
 * las que haya ese día.
 */
export const CONFIRMING_SIGNAL_THRESHOLD = 45;

export function activeSourceCount(
  signals: Signals,
  threshold = CONFIRMING_SIGNAL_THRESHOLD,
): number {
  return presentSources(signals).filter(
    (source) => signals[source]! >= threshold,
  ).length;
}

/** Denominador de activeSourceCount: cuántas fuentes había ese día. */
export function availableSourceCount(signals: Signals): number {
  return presentSources(signals).length;
}

export type SourceBreakdownRow = {
  source: SourceKey;
  value: number;
  weight: number;
  contribution: number;
  change7d: number;
};

/**
 * Aporte de cada fuente al score de hoy, con el peso ya renormalizado: la
 * columna de pesos tiene que sumar 100% y los aportes tienen que sumar el
 * score, o la tabla no explica el número que está al lado.
 */
export function sourceBreakdown(trend: Trend): SourceBreakdownRow[] {
  const history = trend.history;
  const today = history[history.length - 1].signals;
  const past =
    history[Math.max(0, history.length - 1 - MOMENTUM_WINDOW_DAYS)].signals;

  const present = presentSources(today);
  const weightSum = present.reduce(
    (acc, source) => acc + SOURCE_WEIGHTS[source],
    0,
  );

  return present.map((source) => ({
    source,
    value: round1(today[source]!),
    weight: weightSum > 0 ? SOURCE_WEIGHTS[source] / weightSum : 0,
    contribution:
      weightSum > 0
        ? round1((today[source]! * SOURCE_WEIGHTS[source]) / weightSum)
        : 0,
    change7d:
      typeof past[source] === "number"
        ? round1(today[source]! - past[source]!)
        : 0,
  })).sort((a, b) => b.contribution - a.contribution);
}
