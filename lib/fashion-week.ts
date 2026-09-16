import { listContent, readContent } from "@/lib/content";
import { getTrendById } from "@/lib/trends";
import type { Localized, ShopTier, TrendSummary } from "@/lib/types";
import { toSummary } from "@/lib/trends";

const CONTENT_FOLDER = "fashion-week";

/**
 * Colección de pasarela. Es contenido 100% curado: la app no deriva nada de
 * aquí, solo lo renderiza. Lo único que resuelve contra el catálogo son los
 * trendIds, para poder enlazar a la ficha y mostrar su score de hoy.
 */
export type CollectionFile = {
  house: string;
  season: "SS26" | "SS27" | "FW26";
  city: string;
  showDate: string;
  designer: string;
  headline: Localized;
  summary: Localized;
  /** Looks clave: número de salida, descripción y tendencias que toca. */
  looks: {
    number: number;
    title: Localized;
    description: Localized;
    trendIds?: string[];
  }[];
  palette: { name: Localized; hex: string; note?: Localized }[];
  /** Tres prendas comprables, una por nivel. */
  shopping: {
    tier: ShopTier;
    retailer: string;
    label: Localized;
    price: number;
    currency: "MXN" | "USD";
    url: string;
    rationale: Localized;
  }[];
};

export type Collection = CollectionFile & {
  slug: string;
  /** Tendencias del catálogo referenciadas por los looks, resueltas y únicas. */
  trends: TrendSummary[];
};

function resolveTrends(file: CollectionFile): TrendSummary[] {
  const ids = [...new Set(file.looks.flatMap((look) => look.trendIds ?? []))];
  return ids
    .map((id) => getTrendById(id))
    .filter((trend) => Boolean(trend))
    .map((trend) => toSummary(trend!));
}

export function collectionSlugs(): string[] {
  return listContent(CONTENT_FOLDER);
}

export function getCollection(slug: string): Collection | undefined {
  const file = readContent<CollectionFile>(CONTENT_FOLDER, slug);
  if (!file) return undefined;
  return { ...file, slug, trends: resolveTrends(file) };
}

export function listCollections(): Collection[] {
  return collectionSlugs()
    .map((slug) => getCollection(slug))
    .filter((collection): collection is Collection => Boolean(collection))
    .sort(
      (a, b) =>
        b.showDate.localeCompare(a.showDate) || a.house.localeCompare(b.house),
    );
}
