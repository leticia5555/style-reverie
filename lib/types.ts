/** Tipos del dominio. Hoy los alimenta data/trends.seed.json (mock). */

export const SOURCES = [
  "google_trends",
  "pinterest",
  "tiktok",
  "instagram",
  "editorial",
  "amazon",
] as const;
export type SourceKey = (typeof SOURCES)[number];

export const CATEGORIES = [
  "prenda",
  "color",
  "textura",
  "silueta",
  "accesorio",
  "estilo",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LIFECYCLES = [
  "EMERGIENDO",
  "SUBIENDO",
  "PICO",
  "CAYENDO",
] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

export const SHOP_TIERS = ["budget", "mid", "invest"] as const;
export type ShopTier = (typeof SHOP_TIERS)[number];

/**
 * Mercado LATAM/México: los retailers locales cotizan en pesos y los de
 * importación en dólares. Cada link lleva su moneda, no se convierte al vuelo.
 */
export const CURRENCIES = ["MXN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Season = "SS26" | "FW26";

export type Localized = { es: string; en: string };

export type ShopLink = {
  retailer: string;
  label: Localized;
  price: number;
  currency: Currency;
  /** Precio aproximado en USD, solo para ordenar y comparar niveles. */
  priceUsd: number;
  url: string;
};

/** Señales crudas de un día, 0–100 por fuente. */
export type SignalPoint = {
  date: string;
  signals: Record<SourceKey, number>;
};

export type Trend = {
  id: string;
  name: Localized;
  category: Category;
  season: Season;
  summary: Localized;
  /** 90 días de señales, del más antiguo al más reciente. */
  history: SignalPoint[];
  /** Score compuesto de hace 365 días, para la variación anual. */
  scoreYearAgo: number;
  shopping: Record<ShopTier, ShopLink[]>;
};

export type TrendSeed = {
  meta: {
    generatedAt: string;
    asOf: string;
    days: number;
    source: "mock";
    note: Localized;
  };
  trends: Trend[];
};

/** Fila lista para la tabla de /trending. */
export type TrendSummary = {
  id: string;
  name: Localized;
  category: Category;
  season: Season;
  score: number;
  lifecycle: Lifecycle;
  momentum7d: number;
  yoyPct: number;
  sourceCount: number;
  spark: number[];
};
