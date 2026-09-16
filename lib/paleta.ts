import { readContent } from "@/lib/content";
import { getTrendById, getTrends, toSummary } from "@/lib/trends";
import type { Trend } from "@/lib/types";
import type { Category, Localized, TrendSummary } from "@/lib/types";

const CONTENT_FOLDER = "paleta";

/**
 * Con qué combina cada color. Es contenido curado a mano, no derivado.
 *
 * Antes salía de la correlación entre las curvas de 90 días, y con datos de
 * muestra esa correlación no decía nada útil: las curvas están modeladas por
 * ciclo de vida, así que cada color emparejaba con las tendencias de su misma
 * fase y la lista se leía como una repetición del badge. Combinar es un juicio
 * de estilo, no una coincidencia estadística.
 */
export type PaletaFile = {
  /** En orden de preferencia; la app respeta el orden del archivo. */
  pairs: { trendId: string; note?: Localized }[];
};

export type PairedTrend = {
  summary: TrendSummary;
  note: Localized | null;
};

export type PaletteEntry = {
  summary: TrendSummary;
  swatch: string;
  dark: boolean;
  pairs: PairedTrend[];
  /** true si el color todavía no tiene archivo en content/paleta/. */
  uncurated: boolean;
};

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

function resolvePairs(
  colorId: string,
  trends: Trend[],
): {
  pairs: PairedTrend[];
  uncurated: boolean;
} {
  const file = readContent<PaletaFile>(CONTENT_FOLDER, colorId);
  if (!file?.pairs?.length) return { pairs: [], uncurated: true };

  const pairs = file.pairs
    // Un color no combina consigo mismo; si se cuela en el archivo, se ignora.
    .filter((pair) => pair.trendId !== colorId)
    .map((pair) => {
      const trend = getTrendById(pair.trendId, trends);
      return trend
        ? { summary: toSummary(trend), note: pair.note ?? null }
        : null;
    })
    .filter((pair): pair is PairedTrend => Boolean(pair));

  return { pairs, uncurated: false };
}

export function getPaleta(trends: Trend[] = getTrends()): PaletteEntry[] {
  return trends
    .filter(
      (trend): trend is typeof trend & { swatch: string } =>
        trend.category === ("color" satisfies Category) && Boolean(trend.swatch),
    )
    .map((color) => ({
      summary: toSummary(color),
      swatch: color.swatch,
      dark: isDarkSwatch(color.swatch),
      ...resolvePairs(color.id, trends),
    }))
    .sort((a, b) => b.summary.score - a.summary.score);
}

/* ── Color de temporada ────────────────────────────────────────────── */

export type SeasonColor = {
  trendId: string;
  /** Nombre editorial del catálogo, tal cual. */
  name: Localized;
  hex: string;
  dark: boolean;
  score: number;
  momentum7d: number;
  lifecycle: PaletteEntry["summary"]["lifecycle"];
  /** Puesto por score y puesto por momentum, para poder auditar el orden. */
  scoreRank: number;
  momentumRank: number;
};

export type SeasonPalette = {
  colors: SeasonColor[];
  /** Línea de contexto armada con los números de hoy. */
  line: Localized;
};

const rankOf = (ids: string[], id: string) => ids.indexOf(id) + 1;

/**
 * Los cinco colores de la temporada, ordenados por score Y momentum.
 *
 * Se promedian los dos puestos en vez de sumar las magnitudes: score y
 * momentum están en escalas distintas —uno es un nivel de 0 a 100, el otro
 * puntos por semana— y sumarlos daría un número sin significado que además
 * dependería de cuánto se mueva la semana. Promediar puestos es transparente
 * y se puede auditar mirando las dos columnas.
 *
 * ESTO NO ES UN PRONÓSTICO. Describe dónde están los colores hoy según el
 * catálogo, no dónde estarán. La única proyección del producto es la recta de
 * siete días de la ficha, y está etiquetada como estimación.
 */
export function getSeasonPalette(entries: PaletteEntry[]): SeasonPalette | null {
  if (!entries.length) return null;

  const porScore = [...entries]
    .sort((a, b) => b.summary.score - a.summary.score)
    .map((entry) => entry.summary.id);
  const porMomentum = [...entries]
    .sort((a, b) => b.summary.momentum7d - a.summary.momentum7d)
    .map((entry) => entry.summary.id);

  const colors: SeasonColor[] = entries
    .map((entry) => ({
      trendId: entry.summary.id,
      name: entry.summary.name,
      hex: entry.swatch,
      dark: entry.dark,
      score: entry.summary.score,
      momentum7d: entry.summary.momentum7d,
      lifecycle: entry.summary.lifecycle,
      scoreRank: rankOf(porScore, entry.summary.id),
      momentumRank: rankOf(porMomentum, entry.summary.id),
    }))
    .sort((a, b) => {
      const combinado =
        (a.scoreRank + a.momentumRank) / 2 - (b.scoreRank + b.momentumRank) / 2;
      // Empate: manda el score, que es el nivel y no la derivada.
      return combinado !== 0 ? combinado : b.score - a.score;
    });

  const [primero] = colors;
  const acelera = [...colors].sort((a, b) => b.momentum7d - a.momentum7d)[0];
  // Distancia del que acelera contra el líder, no contra el segundo puesto:
  // medirla contra el segundo daba números negativos sin sentido.
  const distancia = Math.abs(primero.score - acelera.score);

  const line: Localized =
    acelera.trendId === primero.trendId
      ? {
          es: `${primero.name.es} manda por las dos vías: ${primero.score.toFixed(1)} de score y el mejor momentum de la paleta, ${primero.momentum7d.toFixed(1)} por semana.`,
          en: `${primero.name.en} leads on both counts: a score of ${primero.score.toFixed(1)} and the palette's best momentum at ${primero.momentum7d.toFixed(1)} a week.`,
        }
      : {
          es: `${primero.name.es} encabeza con ${primero.score.toFixed(1)}, pero ${acelera.name.es.toLowerCase()} es el que corre: ${acelera.momentum7d.toFixed(1)} puntos por semana, con ${distancia.toFixed(1)} de diferencia entre los dos.`,
          en: `${primero.name.en} leads at ${primero.score.toFixed(1)}, but ${acelera.name.en.toLowerCase()} is the one moving: ${acelera.momentum7d.toFixed(1)} points a week, ${distancia.toFixed(1)} apart from the leader.`,
        };

  return { colors, line };
}
