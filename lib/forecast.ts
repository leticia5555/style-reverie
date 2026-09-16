/**
 * Predicción a 7 días por regresión lineal simple sobre los últimos 30 días.
 * Es deliberadamente tonta: extiende la recta que mejor ajusta el último mes.
 * No modela estacionalidad, ni saturación, ni el techo del ciclo de vida.
 */

export const FORECAST_WINDOW_DAYS = 30;
export const FORECAST_HORIZON_DAYS = 7;

export type ForecastPoint = { date: string; forecast: number };

export type Forecast = {
  points: ForecastPoint[];
  /** Puntos de score por día que implica la recta. */
  slopePerDay: number;
  /** Score estimado al final del horizonte. */
  target: number;
  /** R²: qué tan bien la recta describe los 30 días. 0–1. */
  fit: number;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function forecast(
  series: { date: string; score: number }[],
  window = FORECAST_WINDOW_DAYS,
  horizon = FORECAST_HORIZON_DAYS,
): Forecast | null {
  const recent = series.slice(-window);
  if (recent.length < 2) return null;

  // x = días desde el inicio de la ventana, y = score.
  const n = recent.length;
  const meanX = (n - 1) / 2;
  const meanY = recent.reduce((acc, point) => acc + point.score, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (i - meanX) * (recent[i].score - meanY);
    sxx += (i - meanX) ** 2;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // R² sobre la ventana ajustada.
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = intercept + slope * i;
    ssRes += (recent[i].score - predicted) ** 2;
    ssTot += (recent[i].score - meanY) ** 2;
  }
  const fit = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  const lastDate = recent[recent.length - 1].date;
  const points: ForecastPoint[] = [];
  for (let step = 1; step <= horizon; step += 1) {
    const raw = intercept + slope * (n - 1 + step);
    points.push({
      date: addDays(lastDate, step),
      // El score vive en 0–100; la recta no tiene por qué respetarlo.
      forecast: round1(Math.min(100, Math.max(0, raw))),
    });
  }

  return {
    points,
    slopePerDay: round1(slope),
    target: points[points.length - 1].forecast,
    fit: Math.round(fit * 100) / 100,
  };
}
