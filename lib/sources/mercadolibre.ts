import { normalizeTerm } from "@/lib/editorial-match";
import { normalizeToScale, type CollectResult, type Connector, type Reading } from "@/lib/sources/types";
import type { Trend } from "@/lib/types";

/**
 * Mercado Libre Trends para México (site MLM).
 *
 * Es la fuente primaria del mercado: mide búsqueda de compra, no de
 * inspiración. Se persiste con origin 'real'.
 *
 * IMPORTANTE — no entra al score compuesto. CLAUDE.md fija que el score es el
 * promedio ponderado de SEIS señales con pesos concretos; meter una séptima
 * cambiaría todos los scores del catálogo y eso es una decisión de producto,
 * no algo que se decide de paso en un conector. Hasta que se decida, estas
 * lecturas se guardan bajo su propia clave y alimentan el histórico.
 */
export const MERCADOLIBRE_SOURCE = "mercadolibre";
const SITE = "MLM";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const TRENDS_URL = `https://api.mercadolibre.com/trends/${SITE}`;
const TIMEOUT_MS = 15_000;

type TrendEntry = { keyword: string; url?: string };

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} en ${new URL(url).pathname}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OAuth client credentials. El token de Mercado Libre dura unas seis horas;
 * como el cron corre una vez al día, se pide uno nuevo en cada corrida en vez
 * de guardarlo.
 */
export async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const data = await fetchJson<{ access_token?: string }>(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  if (!data.access_token) throw new Error("la respuesta no trae access_token");
  return data.access_token;
}

/**
 * Cruza los términos que devuelve Mercado Libre contra los keywords que ya
 * tiene cada tendencia —los mismos que usa el feed editorial— y cuenta
 * posiciones: cuanto más arriba en el ranking, más peso.
 *
 * El ranking es ordinal, así que un término en el puesto 1 de 100 vale 100 y
 * uno en el 100 vale 1; después se escala el total de cada tendencia a 0–100.
 */
export function mapTrendsToCatalog(
  entries: TrendEntry[],
  trends: Trend[],
  date: string,
): Reading[] {
  const total = entries.length;
  if (!total) return [];

  const raw = new Map<string, number>();
  for (const trend of trends) raw.set(trend.id, 0);

  entries.forEach((entry, index) => {
    const keyword = normalizeTerm(entry.keyword ?? "");
    if (!keyword) return;
    const weight = total - index;

    for (const trend of trends) {
      const hit = trend.keywords.some(
        (candidate) =>
          keyword === candidate ||
          keyword.includes(` ${candidate} `) ||
          keyword.startsWith(`${candidate} `) ||
          keyword.endsWith(` ${candidate}`),
      );
      if (hit) raw.set(trend.id, (raw.get(trend.id) ?? 0) + weight);
    }
  });

  // Solo se escriben las tendencias que aparecieron: un cero real y un
  // "no salió en el ranking" no son lo mismo.
  const seen = new Map([...raw].filter(([, value]) => value > 0));
  if (!seen.size) return [];

  return [...normalizeToScale(seen)].map(([trendId, value]) => ({
    trendId,
    source: MERCADOLIBRE_SOURCE,
    date,
    value,
  }));
}

export const mercadoLibreConnector: Connector = {
  key: MERCADOLIBRE_SOURCE,

  async collect({ trends, date }): Promise<CollectResult> {
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        status: "skipped",
        reason: "faltan ML_CLIENT_ID o ML_CLIENT_SECRET",
      };
    }

    try {
      const token = await getAccessToken(clientId, clientSecret);
      const entries = await fetchJson<TrendEntry[]>(TRENDS_URL, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });

      const readings = mapTrendsToCatalog(entries, trends, date);
      if (!readings.length) {
        return {
          status: "skipped",
          reason: `ningún término del ranking (${entries.length}) cruzó con el catálogo`,
        };
      }
      return { status: "ok", readings };
    } catch (error) {
      return {
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
