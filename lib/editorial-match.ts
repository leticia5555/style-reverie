import type { Trend } from "@/lib/types";

/**
 * Normaliza un texto para comparar: minúsculas, sin acentos, sin guiones ni
 * puntuación y con los espacios colapsados. "Cat-Eye" y "cat eye" tienen que
 * caer en la misma cadena, igual que "Marrón" y "marron".
 */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * Un término de una sola palabra corta genera falsos positivos en titulares
 * ("capa", "obi"); se exige o dos palabras o una palabra suficientemente larga.
 */
const MIN_SINGLE_WORD = 6;

export function isUsableKeyword(keyword: string): boolean {
  if (!keyword) return false;
  return keyword.includes(" ") || keyword.length >= MIN_SINGLE_WORD;
}

/** Match por palabra completa: "capa" no puede casar dentro de "escapada". */
function containsTerm(haystack: string, keyword: string): boolean {
  const index = haystack.indexOf(keyword);
  if (index === -1) return false;
  const before = index === 0 ? " " : haystack[index - 1];
  const afterIndex = index + keyword.length;
  const after = afterIndex >= haystack.length ? " " : haystack[afterIndex];
  return before === " " && after === " ";
}

export type TrendMatch = {
  trendId: string;
  /** El término concreto que disparó el match, para poder auditarlo. */
  keyword: string;
};

/**
 * Qué tendencias del catálogo menciona un artículo. Se busca sobre el título
 * más el resumen, ya normalizados y con espacios en los extremos para que el
 * match por palabra completa funcione también al principio y al final.
 */
export function matchTrends(
  text: string,
  trends: Pick<Trend, "id" | "keywords">[],
): TrendMatch[] {
  const haystack = ` ${normalizeTerm(text)} `;
  const matches: TrendMatch[] = [];

  for (const trend of trends) {
    const hit = trend.keywords
      .filter(isUsableKeyword)
      .find((keyword) => containsTerm(haystack, keyword));
    if (hit) matches.push({ trendId: trend.id, keyword: hit });
  }
  return matches;
}
