import { readContent } from "@/lib/content";
import { getTrendById, getTrends, toSummary } from "@/lib/trends";
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

function resolvePairs(colorId: string): {
  pairs: PairedTrend[];
  uncurated: boolean;
} {
  const file = readContent<PaletaFile>(CONTENT_FOLDER, colorId);
  if (!file?.pairs?.length) return { pairs: [], uncurated: true };

  const pairs = file.pairs
    // Un color no combina consigo mismo; si se cuela en el archivo, se ignora.
    .filter((pair) => pair.trendId !== colorId)
    .map((pair) => {
      const trend = getTrendById(pair.trendId);
      return trend
        ? { summary: toSummary(trend), note: pair.note ?? null }
        : null;
    })
    .filter((pair): pair is PairedTrend => Boolean(pair));

  return { pairs, uncurated: false };
}

export function getPaleta(): PaletteEntry[] {
  return getTrends()
    .filter(
      (trend): trend is typeof trend & { swatch: string } =>
        trend.category === ("color" satisfies Category) && Boolean(trend.swatch),
    )
    .map((color) => ({
      summary: toSummary(color),
      swatch: color.swatch,
      dark: isDarkSwatch(color.swatch),
      ...resolvePairs(color.id),
    }))
    .sort((a, b) => b.summary.score - a.summary.score);
}
