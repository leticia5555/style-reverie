/** Tipos del dominio. Hoy los alimenta data/trends.seed.json (mock). */

export const SOURCES = [
  "google_trends",
  "mercadolibre",
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

export type Season = `SS${string}` | `FW${string}`;

/**
 * Días de señal REAL que necesita una tendencia promovida antes de recibir
 * score, ciclo de vida, momentum y predicción.
 *
 * Dos semanas es el mínimo para que el momentum de 7 días tenga con qué
 * compararse. Antes de eso la tendencia existe y se consulta, pero sale en su
 * propia sección de /trending: un número derivado de tres días tiene la misma
 * pinta que uno derivado de noventa, y esa confusión no puede existir aquí.
 */
export const MIN_REAL_DAYS = 14;

/**
 * Una tendencia promovida que todavía no llega a MIN_REAL_DAYS. No tiene
 * ninguno de los campos derivados porque todavía no se pueden derivar.
 */
export type AccumulatingTrend = {
  id: string;
  name: Localized;
  category: Category;
  season: Season;
  summary: Localized;
  keywords: string[];
  /** Día en que se promovió, ISO corto. */
  promotedAt: string;
  /** Días con al menos una señal real. */
  realDays: number;
  /** Fuentes que ya le respondieron alguna vez. */
  sources: SourceKey[];
};

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

/**
 * Señales crudas de un día, 0–100 por fuente.
 *
 * Parcial a propósito: un día no tiene por qué traer todas las fuentes. Las
 * reales llegan cuando llegan, Pinterest nunca se persiste, y el score se
 * renormaliza sobre lo que hay. Un día sin una fuente no es un día con esa
 * fuente en cero.
 */
export type Signals = Partial<Record<SourceKey, number>>;

export type SignalPoint = {
  date: string;
  signals: Signals;
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
  /**
   * Términos con los que la prensa nombra esta tendencia, ya normalizados.
   * Los usa el match del feed editorial.
   */
  keywords: string[];
  /** Hex del color, solo en las tendencias de categoría color. */
  swatch?: string;
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
  /** Fuentes que participan y tienen valor hoy; el denominador de sourceCount. */
  sourceTotal: number;
  spark: number[];
};
