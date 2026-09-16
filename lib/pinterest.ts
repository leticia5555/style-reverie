import { normalizeTerm } from "@/lib/editorial-match";
import type { Trend } from "@/lib/types";

/**
 * Pinterest Trends, región México. Módulo aparte y deliberadamente estéril.
 *
 * REGLA DURA (CLAUDE.md): los datos de Pinterest NO SE PERSISTEN NUNCA. Ni en
 * la base, ni en archivo, ni en caché de más de una hora. No entran a signals,
 * no los toca el cron, no forman parte del histórico ni del score.
 *
 * Por eso este archivo no importa nada de lib/db ni de node:fs: no ofrece la
 * posibilidad de guardar. Si una sesión futura quiere persistir Pinterest,
 * tiene que romper la regla a propósito, no por descuido.
 *
 * Sobre la otra regla —ninguna fuente externa se llama en el request del
 * usuario—: la llamada vive detrás de /api/pinterest/[id], que el cliente pide
 * después de pintar la ficha. El render de la página nunca depende de que
 * Pinterest responda.
 */
const API = "https://api.pinterest.com/v5/trends/keywords/MX/top/growing";
const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8_000;

export type PinterestSignal = {
  trendId: string;
  /** 0–100 respecto del término más fuerte del ranking de hoy. */
  value: number;
  /** Posición en el ranking de México, 1 es el más fuerte. */
  rank: number;
  keyword: string;
  fetchedAt: string;
};

export type PinterestResult =
  | { status: "ok"; signals: Map<string, PinterestSignal> }
  | { status: "unavailable"; reason: string };

type CacheEntry = { at: number; result: PinterestResult };

/**
 * Caché en memoria del proceso, no en disco ni en base. Se pierde en cada
 * despliegue y en cada arranque en frío, que es exactamente lo que queremos.
 */
let cache: CacheEntry | null = null;

/** Para los tests. */
export function resetPinterestCache(): void {
  cache = null;
}

export function isFresh(entry: CacheEntry | null, now = Date.now()): boolean {
  return entry !== null && now - entry.at < TTL_MS;
}

type TrendKeyword = { keyword: string };

/** Cruza el ranking de Pinterest contra los keywords del catálogo. */
export function matchKeywords(
  keywords: TrendKeyword[],
  trends: Trend[],
  fetchedAt: string,
): Map<string, PinterestSignal> {
  const signals = new Map<string, PinterestSignal>();
  const total = keywords.length;
  if (!total) return signals;

  keywords.forEach((entry, index) => {
    const normalized = normalizeTerm(entry.keyword ?? "");
    if (!normalized) return;

    for (const trend of trends) {
      if (signals.has(trend.id)) continue; // ya casó más arriba en el ranking
      const hit = trend.keywords.some(
        (candidate) =>
          normalized === candidate ||
          normalized.includes(` ${candidate} `) ||
          normalized.startsWith(`${candidate} `) ||
          normalized.endsWith(` ${candidate}`),
      );
      if (!hit) continue;

      signals.set(trend.id, {
        trendId: trend.id,
        // El primero del ranking vale 100 y el último algo por encima de 0.
        value: Math.round(((total - index) / total) * 1000) / 10,
        rank: index + 1,
        keyword: entry.keyword,
        fetchedAt,
      });
    }
  });

  return signals;
}

async function fetchTrends(token: string, trends: Trend[]): Promise<PinterestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "unavailable", reason: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { trends?: TrendKeyword[] };
    const fetchedAt = new Date().toISOString();
    return {
      status: "ok",
      signals: matchKeywords(data.trends ?? [], trends, fetchedAt),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Lectura en vivo con caché de una hora. Nunca escribe nada. */
export async function getPinterestSignals(
  trends: Trend[],
): Promise<PinterestResult> {
  if (isFresh(cache)) return cache!.result;

  const token = process.env.PINTEREST_TOKEN;
  if (!token) {
    const result: PinterestResult = {
      status: "unavailable",
      reason: "falta PINTEREST_TOKEN",
    };
    cache = { at: Date.now(), result };
    return result;
  }

  const result = await fetchTrends(token, trends);
  cache = { at: Date.now(), result };
  return result;
}
