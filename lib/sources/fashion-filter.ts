/**
 * Filtro de titulares antes de mandarlos a la API.
 *
 * El feed trae de todo: belleza, celebridades, resultados trimestrales,
 * nombramientos. Mandar el lote entero cuesta tokens y ensucia la extracción
 * con candidatas que no son prendas. Se filtra aquí, con reglas baratas, y
 * solo lo que parece moda llega al modelo.
 */
import { normalizeTerm } from "@/lib/editorial-match";

/** Señales de que el titular habla de ropa. */
const FASHION_HINTS = [
  "dress", "skirt", "trouser", "pant", "jean", "coat", "jacket", "blazer",
  "knit", "sweater", "shirt", "blouse", "boot", "shoe", "heel", "sandal",
  "bag", "handbag", "belt", "scarf", "denim", "leather", "suede", "linen",
  "silk", "wool", "lace", "sequin", "print", "silhouette", "hemline",
  "runway", "collection", "wardrobe", "outfit", "style", "trend", "look",
  "vestido", "falda", "pantalon", "abrigo", "chaqueta", "punto", "camisa",
  "bota", "zapato", "bolso", "cinturon", "tejido", "pasarela", "prenda",
  "silueta", "armario", "tendencia",
];

/** Temas que comparten vocabulario con moda pero no lo son. */
const EXCLUDE_HINTS = [
  // Belleza
  "makeup", "skincare", "serum", "lipstick", "fragrance", "perfume",
  "haircut", "hairstyle", "manicure", "nail", "mascara", "moisturizer",
  "maquillaje", "perfume", "cabello", "pestanas", "unas",
  // Celebridades y sociales
  "red carpet arrival", "engagement", "wedding photos", "divorce", "baby",
  "instagram post", "dating", "romance", "boda de", "embarazo",
  // Negocio
  "quarterly", "earnings", "revenue", "profit", "shares", "ipo", "merger",
  "acquisition", "layoffs", "lawsuit", "appoints", "steps down", "named ceo",
  "resultados trimestrales", "ingresos", "fusion", "demanda", "nombra",
];

export type Headline = {
  id: string;
  title: string;
  snippet: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
};

const hits = (text: string, terms: string[]) =>
  terms.filter((term) => text.includes(normalizeTerm(term))).length;

/**
 * Un titular pasa si menciona ropa y no está dominado por otro tema.
 *
 * Se exige al menos una señal de moda y que las de exclusión no la superen:
 * "the coat trend at the Oscars red carpet arrival" es moda; "her makeup and
 * hairstyle at the red carpet arrival" no.
 */
export function isFashionHeadline(headline: Headline): boolean {
  const text = normalizeTerm(`${headline.title} ${headline.snippet}`);
  const fashion = hits(text, FASHION_HINTS);
  if (fashion === 0) return false;
  return fashion > hits(text, EXCLUDE_HINTS);
}

export function filterFashion(headlines: Headline[]): Headline[] {
  return headlines.filter(isFashionHeadline);
}
