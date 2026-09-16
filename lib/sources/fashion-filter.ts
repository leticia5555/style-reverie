/**
 * Filtro de titulares antes de mandarlos a la API.
 *
 * El feed trae de todo: belleza, celebridades, resultados trimestrales,
 * nombramientos. Mandar el lote entero cuesta tokens y ensucia la extracción
 * con candidatas que no son prendas. Se filtra aquí, con reglas baratas, y
 * solo lo que parece moda llega al modelo.
 *
 * La primera corrida real enseñó dónde fallaba: los titulares que llegaron
 * eran casi todos de negocio —nombramientos, cadena de suministro,
 * exposiciones— y pasaban porque una nota sobre el nuevo director creativo de
 * una casa dice "collection" y eso contaba como moda. De ahí las dos reglas
 * que se añadieron:
 *
 *  1. Un veto duro. Hay temas que no son una tendencia por muchas prendas que
 *     nombren: un nombramiento, unos aranceles, una retrospectiva de museo.
 *     Un solo término de esa lista tumba el titular, no se cuenta contra nada.
 *  2. Moda concreta. "collection", "runway" o "style" describen el contexto,
 *     no una tendencia; sin una prenda, color o textura concretos hace falta
 *     al menos un par de esas palabras de contexto para seguir.
 */
import { normalizeTerm } from "@/lib/editorial-match";

/**
 * Prendas, colores, texturas y siluetas: lo que sí puede ser una tendencia.
 * Una sola de estas basta para que el titular siga.
 */
const GARMENT_HINTS = [
  "dress", "skirt", "trouser", "pant", "jean", "denim", "coat", "jacket",
  "blazer", "vest", "waistcoat", "knit", "sweater", "cardigan", "shirt",
  "blouse", "boot", "shoe", "heel", "sandal", "loafer", "sneaker", "bag",
  "handbag", "belt", "scarf", "glove", "sunglasses", "jewelry", "leather",
  "suede", "linen", "silk", "wool", "lace", "sequin", "shearling", "crochet",
  "velvet", "satin", "tweed", "hemline", "neckline", "silhouette", "shoulder",
  "waist", "burgundy", "pistachio", "butter yellow", "cocoa", "mocha",
  "vestido", "falda", "pantalon", "jeans", "abrigo", "chaqueta", "saco",
  "chaleco", "punto", "sueter", "camisa", "blusa", "bota", "zapato", "tacon",
  "sandalia", "bolso", "bolsa", "cinturon", "bufanda", "lentes", "gafas",
  "joyeria", "piel", "gamuza", "lino", "seda", "lana", "encaje", "lentejuela",
  "borreguito", "terciopelo", "tweed", "silueta", "hombro", "cintura",
  "prenda", "burdeos", "pistache", "mantequilla", "cacao",
];

/**
 * Vocabulario de moda que describe el contexto, no la tendencia. Solos no
 * alcanzan: una nota de negocio los usa igual que una de tendencias.
 */
const CONTEXT_HINTS = [
  "runway", "collection", "wardrobe", "outfit", "style", "trend", "look",
  "season", "capsule", "print", "pattern", "fit", "tailoring",
  "pasarela", "coleccion", "armario", "atuendo", "estilo", "tendencia",
  "temporada", "capsula", "estampado", "corte", "sastreria",
];

/** Se necesitan dos señales de contexto cuando no hay ninguna prenda. */
const MIN_CONTEXT_WITHOUT_GARMENT = 2;

/**
 * Veto duro: temas que nunca son una tendencia, por mucho que nombren ropa.
 * Aquí está casi todo lo que llegó en la primera corrida real.
 */
const BLOCK_HINTS = [
  // Nombramientos y sillas musicales. Solo el hecho del nombramiento: el
  // cargo suelto ("creative director") sale en cualquier crónica de pasarela
  // y bloquearlo tiraría reseñas que sí traen tendencias.
  "appoints", "appointed", "names new", "steps down", "stepping down",
  "succeeds", "successor", "joins as", "resigns", "hires", "exits",
  "nombra", "nombramiento", "deja el cargo", "sucede a", "ficha a",
  "renuncia",
  // Cadena de suministro y comercio
  "supply chain", "tariff", "tariffs", "customs", "imports", "exports",
  "sourcing", "factory", "factories", "logistics", "warehouse", "wholesale",
  "counterfeit", "trade war",
  "cadena de suministro", "arancel", "aranceles", "aduana", "importaciones",
  "exportaciones", "fabrica", "logistica", "mayoreo", "falsificacion",
  // Resultados y finanzas
  "quarterly", "quarter", "earnings", "revenue", "profit", "shares",
  "ipo", "merger", "acquisition", "acquires", "layoffs", "bankruptcy",
  "lawsuit", "funding round", "valuation", "investors", "sales rose",
  "sales fell", "store opening", "flagship store",
  "resultados trimestrales", "trimestre", "ingresos", "ganancias",
  "adquisicion", "adquiere", "despidos", "quiebra", "ronda de inversion",
  "valuacion", "inversionistas", "apertura de tienda", "tienda insignia",
  // Museo, premios y efemérides
  "exhibition", "retrospective", "museum", "auction", "awards",
  "documentary", "memoir", "obituary", "dies at", "anniversary",
  "exposicion", "retrospectiva", "museo", "subasta", "premios",
  "documental", "memorias", "obituario", "fallece", "aniversario",
];

/** Temas que comparten vocabulario con moda pero no lo son. */
const EXCLUDE_HINTS = [
  // Belleza
  "makeup", "skincare", "serum", "lipstick", "fragrance", "perfume",
  "haircut", "hairstyle", "manicure", "nail", "mascara", "moisturizer",
  "maquillaje", "cabello", "pestanas", "unas",
  // Celebridades y sociales
  "red carpet arrival", "engagement", "wedding photos", "divorce", "baby",
  "instagram post", "dating", "romance", "boda de", "embarazo",
];

export type Headline = {
  id: string;
  title: string;
  snippet: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
};

/**
 * Las listas de moda buscan por subcadena, que es lo que hace que "boot" case
 * con "boots" y "pantalon" con "pantalones".
 */
const hits = (text: string, terms: string[]) =>
  terms.filter((term) => text.includes(normalizeTerm(term))).length;

/**
 * El veto, en cambio, busca por palabra completa más su plural. Un falso
 * positivo aquí tira un titular de moda en silencio, y "ceo" dentro de
 * "océano" o "taps" dentro de "tapstry" es justo eso.
 */
const blocked = (paddedText: string, terms: string[]) =>
  terms.some((term) => {
    const normalized = normalizeTerm(term);
    return (
      paddedText.includes(` ${normalized} `) ||
      paddedText.includes(` ${normalized}s `)
    );
  });

/**
 * Por qué un titular pasó o no. Se devuelve el motivo, no un booleano, para
 * poder registrar el desglose en signal_runs: saber que se descartaron 58 de
 * 120 no dice nada; saber que 40 fueron por el veto de negocio sí.
 */
export type FilterVerdict = "ok" | "bloqueado" | "sin-moda" | "otro-tema";

export function classifyHeadline(headline: Headline): FilterVerdict {
  const text = ` ${normalizeTerm(`${headline.title} ${headline.snippet}`)} `;

  if (blocked(text, BLOCK_HINTS)) return "bloqueado";

  const garment = hits(text, GARMENT_HINTS);
  const context = hits(text, CONTEXT_HINTS);
  if (garment === 0 && context < MIN_CONTEXT_WITHOUT_GARMENT) return "sin-moda";

  // "the coat trend at the Oscars red carpet arrival" es moda; "her makeup
  // and hairstyle at the red carpet arrival" no.
  if (garment + context <= hits(text, EXCLUDE_HINTS)) return "otro-tema";

  return "ok";
}

export function isFashionHeadline(headline: Headline): boolean {
  return classifyHeadline(headline) === "ok";
}

export function filterFashion(headlines: Headline[]): Headline[] {
  return headlines.filter(isFashionHeadline);
}

/** Cuántos titulares cayó cada regla, para la bitácora de la corrida. */
export type FilterBreakdown = Record<FilterVerdict, number>;

export function filterBreakdown(headlines: Headline[]): FilterBreakdown {
  const counts: FilterBreakdown = {
    ok: 0,
    bloqueado: 0,
    "sin-moda": 0,
    "otro-tema": 0,
  };
  for (const headline of headlines) counts[classifyHeadline(headline)] += 1;
  return counts;
}
