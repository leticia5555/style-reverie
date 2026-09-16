import { scoreSeries } from "@/lib/scoring";
import { getTrends, toSummary } from "@/lib/trends";
import type { Category, TrendSummary } from "@/lib/types";

/**
 * Correlación de Pearson entre dos series. Se aplica sobre los scores diarios
 * de 90 días: dos tendencias con correlación alta han recorrido la misma
 * curva, que es lo más cercano a "van juntas" que se puede derivar del
 * catálogo sin escribirlo a mano.
 */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const meanA = a.reduce((x, y) => x + y, 0) / n;
  const meanB = b.reduce((x, y) => x + y, 0) / n;

  let num = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }
  const den = Math.sqrt(varA * varB);
  return den === 0 ? 0 : num / den;
}

/** Luminancia relativa, para decidir si el hex lleva tinta clara u oscura. */
export function isDarkSwatch(hex: string): boolean {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  // 0.25 deja tinta clara solo en los genuinamente oscuros: burdeos y cacao
  // caen en 0.05 y 0.08, mientras que matcha y azul polvo rondan 0.45.
  return luminance < 0.25;
}

export type PairedTrend = {
  summary: TrendSummary;
  correlation: number;
};

export type PaletteEntry = {
  summary: TrendSummary;
  swatch: string;
  dark: boolean;
  /** Tendencias cuya curva de 90 días más se parece a la de este color. */
  pairs: PairedTrend[];
};

const PAIRS_PER_COLOR = 4;
/** Por debajo de esto las dos curvas no se parecen lo suficiente. */
const MIN_CORRELATION = 0.9;

export function getPaleta(): PaletteEntry[] {
  const trends = getTrends();
  const series = new Map(
    trends.map((trend) => [trend.id, scoreSeries(trend.history)]),
  );

  return trends
    .filter(
      (trend): trend is typeof trend & { swatch: string } =>
        trend.category === ("color" satisfies Category) && Boolean(trend.swatch),
    )
    .map((color) => {
      const own = series.get(color.id)!;
      const pairs = trends
        .filter((other) => other.id !== color.id)
        .map((other) => ({
          summary: toSummary(other),
          correlation: correlation(own, series.get(other.id)!),
        }))
        .filter((pair) => pair.correlation >= MIN_CORRELATION)
        .sort((a, b) => b.correlation - a.correlation)
        .slice(0, PAIRS_PER_COLOR);

      return {
        summary: toSummary(color),
        swatch: color.swatch,
        dark: isDarkSwatch(color.swatch),
        pairs,
      };
    })
    .sort((a, b) => b.summary.score - a.summary.score);
}
