import { listContent, readContent } from "@/lib/content";
import type { Accent } from "@/lib/ocasiones-accent";
import { getTrendById, toSummary } from "@/lib/trends";
import type { Localized, ShopTier, TrendSummary } from "@/lib/types";

const CONTENT_FOLDER = "ocasiones";

export type OcasionFile = {
  /** Orden en el índice; si falta, va al final. */
  order?: number;
  name: Localized;
  tagline: Localized;
  intro: Localized;
  /** Color pastel de la ocasión, de los tokens de marca. */
  accent: Accent;
  /** Tendencias del catálogo que aplican, con la nota de por qué. */
  trends: { trendId: string; note: Localized }[];
  /** Prendas concretas, con nivel de precio. */
  pieces: {
    tier: ShopTier;
    retailer: string;
    label: Localized;
    price: number;
    currency: "MXN" | "USD";
    url: string;
    note?: Localized;
  }[];
  /** Lo que conviene evitar: un consejo de estilista vale lo mismo en negativo. */
  avoid?: Localized[];
};

export type OcasionTrend = { summary: TrendSummary; note: Localized };

export type Ocasion = Omit<OcasionFile, "trends"> & {
  slug: string;
  trends: OcasionTrend[];
};

export function ocasionSlugs(): string[] {
  return listContent(CONTENT_FOLDER);
}

export function getOcasion(slug: string): Ocasion | undefined {
  const file = readContent<OcasionFile>(CONTENT_FOLDER, slug);
  if (!file) return undefined;

  const trends = file.trends
    .map((entry) => {
      const trend = getTrendById(entry.trendId);
      return trend ? { summary: toSummary(trend), note: entry.note } : null;
    })
    .filter((entry): entry is OcasionTrend => Boolean(entry))
    .sort((a, b) => b.summary.score - a.summary.score);

  return { ...file, slug, trends };
}

export function listOcasiones(): Ocasion[] {
  return ocasionSlugs()
    .map((slug) => getOcasion(slug))
    .filter((ocasion): ocasion is Ocasion => Boolean(ocasion))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
