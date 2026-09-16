/**
 * Clasifica un sinónimo por idioma, para que el matcher pueda buscar solo en
 * el idioma de la fuente.
 *
 * Un titular de Vogue México se cruza con keywords en español y uno de
 * Fashionista con los de inglés. Sin esto, "wine red" podría casar contra un
 * texto español por casualidad y "vino tinto" contra uno inglés.
 *
 * Los préstamos puros —boho, matcha, crochet, oversize— van a LOS DOS: la
 * prensa mexicana los usa igual que la anglosajona, y meterlos en un solo
 * idioma perdería coincidencias reales.
 */
const ES_MARKERS = [
  "pantalon", "barril", "chaleco", "largo", "falda", "utilitaria", "capa",
  "bermuda", "bermudas", "sastre", "amarillo", "mantequilla", "burdeos",
  "vino", "tinto", "verde", "pistache", "azul", "empolvado", "polvo", "cafe",
  "marron", "cacao", "gamuza", "ganchillo", "lentejuela", "lentejuelas",
  "borreguito", "hombreras", "hombro", "estructurado", "talle", "bajo",
  "cintura", "caida", "columna", "linea", "corte", "holgado", "bolsa",
  "bolso", "zapatos", "cinturon", "ancho", "faja", "lentes", "gafas", "lujo",
  "silencioso", "estilo", "ante", "cepillado", "fino", "relajado", "planas",
  "vestido", "camisa", "abrigo",
];

const EN_MARKERS = [
  "barrel", "leg", "curved", "trousers", "waistcoat", "vest", "longline",
  "tailored", "skirt", "utility", "maxi", "cape", "coat", "capelet", "shorts",
  "butter", "yellow", "buttery", "tone", "burgundy", "bordeaux", "deep",
  "wine", "red", "green", "pistachio", "dusty", "powder", "blue", "cocoa",
  "brown", "mocha", "brushed", "suede", "fine", "gauge", "matte", "sequin",
  "sequins", "curly", "faux", "shearling", "teddy", "power", "shoulder",
  "pads", "structured", "blazer", "drop", "dropped", "waist", "low", "dress",
  "column", "silhouette", "oversized", "fit", "relaxed", "bag", "slouchy",
  "flat", "flats", "janes", "belt", "wide", "frames", "sunglasses", "quiet",
  "luxury", "stealth", "wealth", "old", "money", "bohemian", "chic", "neo",
  "secretary", "long", "jeans", "shirt",
];

export type KeywordLang = "es" | "en" | "both";

export function classifyTerm(term: string): KeywordLang {
  const words = term.toLowerCase().split(/\s+/);
  const es = words.some((word) => ES_MARKERS.includes(word));
  const en = words.some((word) => EN_MARKERS.includes(word));

  if (es && !en) return "es";
  if (en && !es) return "en";
  // Mezcla ("gafas cat eye") o préstamo puro ("boho"): sirve en ambos.
  return "both";
}

/**
 * Los keywords de una tendencia que sirven para una fuente de ese idioma.
 * Los `both` entran siempre; si el filtro dejara la lista vacía se devuelve
 * la original, porque una tendencia sin ningún término en español seguiría
 * mencionándose en la prensa mexicana por su nombre en inglés.
 */
export function keywordsFor(keywords: string[], lang?: KeywordLang): string[] {
  if (!lang || lang === "both") return keywords;
  const filtered = keywords.filter((keyword) => {
    const term = classifyTerm(keyword);
    return term === lang || term === "both";
  });
  return filtered.length ? filtered : keywords;
}
