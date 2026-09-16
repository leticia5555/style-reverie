import { listContent, readContent } from "@/lib/content";
import {
  countRisingDays,
  getTrendById,
  getTrends,
  historyDates,
  summaryAsOf,
} from "@/lib/trends";
import { scoreSeries } from "@/lib/scoring";
import type { Localized, ShopLink, ShopTier, TrendSummary } from "@/lib/types";

export const EDICION_SIZE = 5;
/**
 * Días de histórico mínimos para publicar una edición: con menos, el momentum
 * y la racha de días subiendo todavía no significan nada.
 */
const MIN_HISTORY_DAYS = 30;

const CONTENT_FOLDER = "ediciones";

/** Lo que se puede sobreescribir a mano en content/ediciones/YYYY-MM-DD.json */
export type EdicionOverride = {
  intro?: Localized;
  /** Si viene, reemplaza la selección automática, en este orden. */
  picks?: { trendId: string; reason?: Localized; note?: Localized }[];
};

export type EdicionPick = {
  summary: TrendSummary;
  description: Localized;
  /** Por qué comprarla esta semana. Derivada, o escrita a mano en el override. */
  reason: Localized;
  /** Nota editorial opcional, solo si se escribió a mano. */
  note: Localized | null;
  shopping: Record<ShopTier, ShopLink[]>;
  risingDays: number;
};

export type Edicion = {
  date: string;
  intro: Localized;
  picks: EdicionPick[];
  /** true si hay archivo en content/: la selección o los textos son a mano. */
  curated: boolean;
};

/** Domingos del histórico con suficiente recorrido detrás, del más nuevo al más viejo. */
export function edicionDates(): string[] {
  return historyDates()
    .filter((date, index) => {
      if (index + 1 < MIN_HISTORY_DAYS) return false;
      return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
    })
    .reverse();
}

export function currentEdicionDate(): string {
  return edicionDates()[0];
}

/**
 * Frases de urgencia por ciclo de vida. Se elige una de forma determinista por
 * tendencia para que la edición no lea como una plantilla repetida cinco veces.
 */
const REASONS: Record<"EMERGIENDO" | "SUBIENDO", ((v: Vars) => Localized)[]> = {
  EMERGIENDO: [
    (v) => ({
      es: `Sube ${v.momentum} puntos en siete días y sigue en ${v.score}: se compra ahora, antes de que el retail masivo la copie y suba el precio.`,
      en: `Up ${v.momentum} points in seven days and still at ${v.score}: buy it now, before mass retail copies it and the price follows.`,
    }),
    (v) => ({
      es: `Lleva ${v.risingDays} días subiendo y todavía ${
        v.sources === 1
          ? "la confirma una sola fuente"
          : `la confirman ${v.sources} de seis fuentes`
      }. Entrar aquí es entrar temprano.`,
      en: `Climbing for ${v.risingDays} days and still confirmed by ${
        v.sources === 1 ? "a single source" : `${v.sources} of six sources`
      }. Getting in here is getting in early.`,
    }),
    (v) => ({
      es: `De ${v.startScore} a ${v.score} en ${v.risingDays} días. Aún no está en todas las tiendas, que es exactamente el momento.`,
      en: `From ${v.startScore} to ${v.score} in ${v.risingDays} days. Not in every store yet, which is exactly the point.`,
    }),
  ],
  SUBIENDO: [
    (v) => ({
      es: `Ya ${
        v.sources === 1 ? "la lleva una fuente" : `la llevan ${v.sources} de seis fuentes`
      } y sigue ganando ${v.momentum} puntos por semana. Queda margen, pero se acorta.`,
      en: `Already carried by ${
        v.sources === 1 ? "a single source" : `${v.sources} of six sources`
      } and still gaining ${v.momentum} points a week. There is room left, but it is closing.`,
    }),
    (v) => ({
      es: `Score ${v.score} y ${v.risingDays} días de subida continua: la temporada que viene esto es precio de pico.`,
      en: `Score ${v.score} and ${v.risingDays} straight days climbing: next season this is peak pricing.`,
    }),
    (v) => ({
      es: `+${v.yoy}% contra el año pasado y todavía no toca techo. Comprarla ahora es comprarla antes del pico.`,
      en: `+${v.yoy}% year on year and no ceiling yet. Buying now is buying ahead of the peak.`,
    }),
  ],
};

type Vars = {
  score: string;
  momentum: string;
  risingDays: number;
  sources: number;
  yoy: string;
  startScore: string;
};

function hashIndex(seed: string, length: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % length;
}

function buildReason(
  summary: TrendSummary,
  risingDays: number,
  startScore: number,
): Localized {
  const family = summary.lifecycle === "EMERGIENDO" ? "EMERGIENDO" : "SUBIENDO";
  const variants = REASONS[family];
  const vars: Vars = {
    score: summary.score.toFixed(1),
    momentum: summary.momentum7d.toFixed(1),
    risingDays,
    sources: summary.sourceCount,
    yoy: Math.round(summary.yoyPct).toString(),
    startScore: startScore.toFixed(1),
  };
  return variants[hashIndex(`${summary.id}#${family}`, variants.length)](vars);
}

const DEFAULT_INTRO: Localized = {
  es: "Cinco prendas para comprar esta semana, elegidas por momentum entre las tendencias que todavía no llegaron al pico.",
  en: "Five pieces to buy this week, picked by momentum among trends that have not peaked yet.",
};

function buildPick(trendId: string, date: string): EdicionPick | null {
  const trend = getTrendById(trendId);
  if (!trend) return null;
  const summary = summaryAsOf(trend, date);
  if (!summary) return null;

  const index = trend.history.findIndex((point) => point.date === date);
  const series = scoreSeries(trend.history.slice(0, index + 1));
  const risingDays = countRisingDays(series);
  const startScore = series[Math.max(0, series.length - 1 - risingDays)];

  return {
    summary,
    description: trend.summary,
    reason: buildReason(summary, risingDays, startScore),
    note: null,
    shopping: trend.shopping,
    risingDays,
  };
}

/** Selección automática: mayor momentum entre SUBIENDO y EMERGIENDO esa semana. */
function autoSelection(date: string): string[] {
  return getTrends()
    .map((trend) => summaryAsOf(trend, date))
    .filter((summary): summary is TrendSummary => Boolean(summary))
    .filter(
      (summary) =>
        summary.lifecycle === "SUBIENDO" || summary.lifecycle === "EMERGIENDO",
    )
    .sort((a, b) => b.momentum7d - a.momentum7d)
    .slice(0, EDICION_SIZE)
    .map((summary) => summary.id);
}

export function getEdicion(date: string): Edicion | undefined {
  if (!edicionDates().includes(date)) return undefined;

  const override = readContent<EdicionOverride>(CONTENT_FOLDER, date);
  const ids = override?.picks?.length
    ? override.picks.map((pick) => pick.trendId)
    : autoSelection(date);

  const picks = ids
    .map((id) => {
      const pick = buildPick(id, date);
      if (!pick) return null;
      const manual = override?.picks?.find((entry) => entry.trendId === id);
      return {
        ...pick,
        reason: manual?.reason ?? pick.reason,
        note: manual?.note ?? null,
      };
    })
    .filter((pick): pick is EdicionPick => Boolean(pick));

  return {
    date,
    intro: override?.intro ?? DEFAULT_INTRO,
    picks,
    curated: Boolean(override),
  };
}

export type EdicionSummary = {
  date: string;
  curated: boolean;
  count: number;
  /** Nombres de las prendas, para la línea del archivo. */
  names: Localized[];
};

export function listEdiciones(): EdicionSummary[] {
  const curatedDates = new Set(listContent(CONTENT_FOLDER));
  return edicionDates().map((date) => {
    const edicion = getEdicion(date);
    return {
      date,
      curated: curatedDates.has(date),
      count: edicion?.picks.length ?? 0,
      names: edicion?.picks.map((pick) => pick.summary.name) ?? [],
    };
  });
}
