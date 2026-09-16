/**
 * Genera data/trends.seed.json: 90 días de señales por fuente para cada
 * tendencia del catálogo, con curvas coherentes con su ciclo de vida.
 *
 *   npm run seed
 *
 * El generador es determinista (PRNG con semilla por id) y verifica que el
 * ciclo de vida derivado por lib/lifecycle.ts coincida con el que se buscaba.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveLifecycle } from "@/lib/lifecycle";
import { computeScore, momentum, SOURCE_WEIGHTS } from "@/lib/scoring";
import {
  SOURCES,
  type Currency,
  type Lifecycle,
  type ShopLink,
  type ShopTier,
  type SignalPoint,
  type SourceKey,
  type Trend,
  type TrendSeed,
} from "@/lib/types";
import { TREND_SPECS, type TrendSpec } from "./trend-specs";

const DAYS = 90;
const AS_OF = "2026-09-14";
/** Editorial se adelanta a la calle; Amazon va por detrás. */
const SOURCE_LAG: Record<SourceKey, number> = {
  google_trends: 0,
  pinterest: -3,
  tiktok: -5,
  instagram: 0,
  editorial: -10,
  amazon: 12,
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function isoDate(daysBeforeAsOf: number): string {
  const base = new Date(`${AS_OF}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - daysBeforeAsOf);
  return base.toISOString().slice(0, 10);
}

/**
 * Curva base del score, indexada desde -MAX_LAG hasta DAYS + MAX_LEAD.
 * Cada ciclo de vida tiene su forma: convexa al emerger, casi plana en el pico,
 * cóncava al caer.
 */
function baseCurve(target: Lifecycle, rng: Rng): (index: number) => number {
  let start: number;
  let end: number;
  let shape: (t: number) => number;

  switch (target) {
    case "EMERGIENDO":
      start = between(rng, 14, 26);
      end = between(rng, 42, 54);
      shape = (t) => Math.pow(t, 1.9);
      break;
    case "SUBIENDO":
      start = between(rng, 38, 50);
      end = between(rng, 66, 78);
      shape = (t) => Math.pow(t, 1.2);
      break;
    case "PICO":
      start = between(rng, 62, 74);
      end = between(rng, 82, 93);
      shape = (t) => 1 - Math.pow(1 - t, 2.4);
      break;
    case "CAYENDO":
      start = between(rng, 74, 88);
      end = between(rng, 44, 60);
      shape = (t) => Math.pow(t, 1.25);
      break;
  }

  const wobbleAmp = target === "PICO" ? 0.7 : 1.1;
  const wobblePhase = between(rng, 0, Math.PI * 2);
  const weeklyAmp = between(rng, 0.4, 0.9);

  return (index: number) => {
    const t = clamp(index / (DAYS - 1), -0.2, 1.2);
    const trend = start + (end - start) * shape(clamp(t, 0, 1));
    const drift = t > 1 ? (end - start) * 0.02 * (t - 1) : 0;
    // Onda lenta de ~28 días + ciclo semanal (se cancela en ventanas de 7 días).
    const wobble =
      wobbleAmp * Math.sin((index / 28) * Math.PI * 2 + wobblePhase) +
      weeklyAmp * Math.sin((index / 7) * Math.PI * 2);
    return trend + drift + wobble;
  };
}

/**
 * Reparte la curva entre las seis fuentes. Los sesgos y desplazamientos se
 * normalizan contra los pesos para que el promedio ponderado siga siendo la curva.
 */
function sourceProfile(rng: Rng) {
  const biasRaw = {} as Record<SourceKey, number>;
  const offsetRaw = {} as Record<SourceKey, number>;
  for (const source of SOURCES) {
    biasRaw[source] = 1 + between(rng, -0.12, 0.12);
    offsetRaw[source] = between(rng, -5, 5);
  }
  const biasMean = SOURCES.reduce((a, s) => a + biasRaw[s] * SOURCE_WEIGHTS[s], 0);
  const offsetMean = SOURCES.reduce((a, s) => a + offsetRaw[s] * SOURCE_WEIGHTS[s], 0);

  const bias = {} as Record<SourceKey, number>;
  const offset = {} as Record<SourceKey, number>;
  for (const source of SOURCES) {
    bias[source] = biasRaw[source] / biasMean;
    offset[source] = offsetRaw[source] - offsetMean;
  }
  return { bias, offset };
}

function buildHistory(spec: TrendSpec, attempt: number): SignalPoint[] {
  const rng = mulberry32(hash(`${spec.id}#${attempt}`));
  const curve = baseCurve(spec.target, rng);
  const { bias, offset } = sourceProfile(rng);
  const noiseRng = mulberry32(hash(`${spec.id}#noise#${attempt}`));

  const history: SignalPoint[] = [];
  for (let i = 0; i < DAYS; i += 1) {
    const signals = {} as Record<SourceKey, number>;
    for (const source of SOURCES) {
      const value =
        curve(i - SOURCE_LAG[source]) * bias[source] +
        offset[source] +
        between(noiseRng, -1.6, 1.6);
      signals[source] = round1(clamp(value, 2, 98));
    }
    history.push({ date: isoDate(DAYS - 1 - i), signals });
  }
  return history;
}

/** Score de hace un año: define la variación anual que verá el usuario. */
function scoreYearAgo(target: Lifecycle, score: number, rng: Rng): number {
  const ratio: Record<Lifecycle, [number, number]> = {
    EMERGIENDO: [0.26, 0.44],
    SUBIENDO: [0.42, 0.62],
    PICO: [0.62, 0.85],
    CAYENDO: [1.18, 1.55],
  };
  const [min, max] = ratio[target];
  return round1(clamp(score * between(rng, min, max), 4, 97));
}

const VARIANTS: Record<string, { es: string; en: string }[]> = {
  prenda: [
    { es: "en lino", en: "in linen" },
    { es: "en sarga", en: "in twill" },
    { es: "en lana fría", en: "in tropical wool" },
  ],
  color: [
    { es: "en punto fino", en: "in fine knit" },
    { es: "en seda lavada", en: "in washed silk" },
    { es: "en algodón", en: "in cotton" },
  ],
  textura: [
    { es: "en versión corta", en: "cropped" },
    { es: "con cuello alto", en: "high-neck" },
    { es: "en tono crudo", en: "in ecru" },
  ],
  silueta: [
    { es: "en largo midi", en: "midi length" },
    { es: "con hombreras", en: "with shoulder pads" },
    { es: "en negro", en: "in black" },
  ],
  accesorio: [
    { es: "en piel", en: "in leather" },
    { es: "en charol", en: "in patent" },
    { es: "en ante", en: "in suede" },
  ],
  estilo: [
    { es: "en pieza cápsula", en: "as a capsule piece" },
    { es: "en corte minimal", en: "in a minimal cut" },
    { es: "en clave de temporada", en: "in a seasonal cut" },
  ],
};

/**
 * Mercado objetivo: LATAM con foco en México.
 * Los retailers locales cotizan en MXN y los de importación en USD; la moneda
 * va pegada al retailer, no al nivel de precio. Los locales buscan con el
 * término en español y los de importación con el término en inglés.
 */
type Retailer = {
  name: string;
  currency: Currency;
  /** true = busca con el término en español. */
  local: boolean;
  url: (q: string) => string;
};

const RETAILERS: Record<ShopTier, Retailer[]> = {
  budget: [
    {
      name: "Shein",
      currency: "MXN",
      local: true,
      url: (q) => `https://mx.shein.com/pdsearch/${q}/`,
    },
    {
      name: "Zara México",
      currency: "MXN",
      local: true,
      url: (q) => `https://www.zara.com/mx/es/search?searchTerm=${q}`,
    },
    {
      name: "Amazon México",
      currency: "MXN",
      local: true,
      url: (q) => `https://www.amazon.com.mx/s?k=${q}`,
    },
  ],
  mid: [
    {
      name: "Liverpool",
      currency: "MXN",
      local: true,
      url: (q) => `https://www.liverpool.com.mx/tienda/?s=${q}`,
    },
    {
      name: "ASOS",
      currency: "USD",
      local: false,
      url: (q) => `https://www.asos.com/us/search/?q=${q}`,
    },
    {
      name: "Revolve",
      currency: "USD",
      local: false,
      url: (q) => `https://www.revolve.com/r/Search.jsp?search=${q}`,
    },
  ],
  invest: [
    {
      name: "Nordstrom",
      currency: "USD",
      local: false,
      url: (q) => `https://www.nordstrom.com/sr?keyword=${q}`,
    },
    {
      name: "Revolve",
      currency: "USD",
      local: false,
      url: (q) => `https://www.revolve.com/r/Search.jsp?search=${q}`,
    },
  ],
};

/**
 * Tipo de cambio de referencia, estático y aproximado. Solo sirve para que los
 * tres niveles queden ordenados entre monedas; no es una cotización real.
 */
const MXN_PER_USD = 18;

/** Rangos por nivel, en USD. El precio en MXN se deriva de aquí. */
const PRICE_RANGE_USD: Record<ShopTier, [number, number]> = {
  budget: [12, 55],
  mid: [75, 260],
  invest: [320, 1600],
};

/** Los precios mexicanos terminan en 9; los de importación, en .95 o redondos. */
function priceIn(currency: Currency, usd: number, tier: ShopTier): number {
  if (currency === "MXN") {
    const pesos = usd * MXN_PER_USD;
    const step = pesos >= 2000 ? 100 : 10;
    return Math.max(step, Math.round(pesos / step) * step) - 1;
  }
  return tier === "invest" ? Math.round(usd / 10) * 10 : Math.round(usd) - 0.05;
}

function buildShopping(spec: TrendSpec, rng: Rng): Record<ShopTier, ShopLink[]> {
  const queryEs = encodeURIComponent(spec.term.es);
  const queryEn = encodeURIComponent(spec.term.en);
  const variants = VARIANTS[spec.category];
  const shopping = {} as Record<ShopTier, ShopLink[]>;

  for (const tier of ["budget", "mid", "invest"] as ShopTier[]) {
    const pool = RETAILERS[tier];
    const first = Math.floor(rng() * pool.length);
    const second = (first + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length;
    const variant = variants[Math.floor(rng() * variants.length)];
    const [min, max] = PRICE_RANGE_USD[tier];

    // El segundo link se deriva del primero para que nunca caigan al mismo
    // precio tras redondear: mismo producto, retailer más caro.
    const anchor = between(rng, min, max * 0.78);
    const step = between(rng, 1.2, 1.6);
    const usdBySlot = [anchor, clamp(anchor * step, min, max * 1.2)];

    shopping[tier] = [first, second].map((index, slot) => {
      const retailer = pool[index];
      const usd = usdBySlot[slot];
      return {
        retailer: retailer.name,
        label:
          slot === 0
            ? { es: spec.name.es, en: spec.name.en }
            : {
                es: `${spec.name.es} ${variant.es}`,
                en: `${spec.name.en}, ${variant.en}`,
              },
        price: priceIn(retailer.currency, usd, tier),
        currency: retailer.currency,
        priceUsd: Math.round(usd * 100) / 100,
        url: retailer.url(retailer.local ? queryEs : queryEn),
      };
    });
  }
  return shopping;
}

function buildTrend(spec: TrendSpec): Trend {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const history = buildHistory(spec, attempt);
    const score = computeScore(history[history.length - 1].signals);
    const momentum7d = momentum(history);
    if (deriveLifecycle(score, momentum7d) !== spec.target) continue;

    const rng = mulberry32(hash(`${spec.id}#meta#${attempt}`));
    return {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      season: spec.season,
      summary: spec.summary,
      history,
      scoreYearAgo: scoreYearAgo(spec.target, score, rng),
      shopping: buildShopping(spec, rng),
    };
  }
  throw new Error(
    `No se pudo generar una curva ${spec.target} para "${spec.id}" en 600 intentos`,
  );
}

function main() {
  const trends = TREND_SPECS.map(buildTrend);

  const seed: TrendSeed = {
    meta: {
      generatedAt: `${AS_OF}T00:00:00.000Z`,
      asOf: AS_OF,
      days: DAYS,
      source: "mock",
      note: {
        es: "Datos de muestra generados por scripts/generate-seed.ts. No son señales reales de mercado.",
        en: "Sample data generated by scripts/generate-seed.ts. Not real market signals.",
      },
    },
    trends,
  };

  const out = resolve(process.cwd(), "data/trends.seed.json");
  writeFileSync(out, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  const counts = new Map<Lifecycle, number>();
  for (const trend of trends) {
    const score = computeScore(trend.history[trend.history.length - 1].signals);
    const momentum7d = momentum(trend.history);
    const lifecycle = deriveLifecycle(score, momentum7d);
    counts.set(lifecycle, (counts.get(lifecycle) ?? 0) + 1);
    console.log(
      `${trend.id.padEnd(24)} ${String(score).padStart(5)}  ${String(momentum7d).padStart(6)}  ${lifecycle}`,
    );
  }
  console.log(`\n${trends.length} tendencias · ${DAYS} días · ${out}`);
  console.log([...counts].map(([k, v]) => `${k}: ${v}`).join("  ·  "));
}

main();
