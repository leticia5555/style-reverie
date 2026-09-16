import type { Category, Lifecycle, Localized, Season } from "@/lib/types";

/**
 * Catálogo editorial de tendencias SS26/FW26.
 * `target` es la forma de curva que debe producir el generador; el ciclo de vida
 * que consume la app siempre se re-deriva del score y el momentum.
 */
export type TrendSpec = {
  id: string;
  name: Localized;
  category: Category;
  season: Season;
  summary: Localized;
  /** Término de búsqueda para los links de compra. */
  term: Localized;
  /**
   * Cómo nombra la prensa a esta tendencia, en ambos idiomas. Alimenta el
   * match del feed editorial; el nombre y el término ya se incluyen solos.
   */
  synonyms: string[];
  /** Solo para categoría color: el hex del swatch que se pinta en /paleta. */
  swatch?: string;
  target: Lifecycle;
};

export const TREND_SPECS: TrendSpec[] = [
  {
    id: "pantalon-barril",
    name: { es: "Pantalón barril", en: "Barrel-leg trousers" },
    category: "prenda",
    season: "FW26",
    summary: {
      es: "La pierna curva que sustituyó al wide leg. Ya llegó al retail masivo y su búsqueda se aplanó.",
      en: "The curved leg that replaced wide-leg. Now in mass retail, with search interest flattening out.",
    },
    term: { es: "pantalon barril", en: "barrel leg trousers" },
    synonyms: [
      "barrel jeans",
      "barrel leg",
      "pantalon barril",
      "jeans barril",
      "banana jeans",
      "curved leg",
    ],
    target: "PICO",
  },
  {
    id: "chaleco-sastre-largo",
    name: { es: "Chaleco sastre largo", en: "Longline tailored waistcoat" },
    category: "prenda",
    season: "SS26",
    summary: {
      es: "Chaleco a la altura de la rodilla usado como prenda única. Editorial y Pinterest lo empujan a la vez.",
      en: "Knee-length waistcoat worn as a standalone piece. Editorial and Pinterest are pushing it together.",
    },
    term: { es: "chaleco sastre largo", en: "longline waistcoat" },
    synonyms: [
      "longline waistcoat",
      "long waistcoat",
      "chaleco largo",
      "tailored vest",
      "long vest",
      "waistcoat",
    ],
    target: "SUBIENDO",
  },
  {
    id: "falda-cargo",
    name: { es: "Falda cargo maxi", en: "Cargo maxi skirt" },
    category: "prenda",
    season: "SS26",
    summary: {
      es: "Utilitaria y larga, con bolsillos de parche. Todavía nicho, pero acelerando en TikTok.",
      en: "Utility-driven and floor-length, with patch pockets. Still niche, but accelerating on TikTok.",
    },
    term: { es: "falda cargo maxi", en: "cargo maxi skirt" },
    synonyms: [
      "cargo skirt",
      "falda cargo",
      "utility skirt",
      "falda utilitaria",
      "maxi cargo",
    ],
    target: "EMERGIENDO",
  },
  {
    id: "abrigo-capa",
    name: { es: "Abrigo capa", en: "Cape coat" },
    category: "prenda",
    season: "FW26",
    summary: {
      es: "Abrigo sin mangas marcadas, de corte dramático. Entra fuerte con la temporada fría.",
      en: "Sleeveless dramatic outerwear. Building hard as the cold season starts.",
    },
    term: { es: "abrigo capa", en: "cape coat" },
    synonyms: ["cape coat", "abrigo capa", "capelet", "capa"],
    target: "SUBIENDO",
  },
  {
    id: "bermuda-sastre",
    name: { es: "Bermuda de sastre", en: "Tailored bermuda" },
    category: "prenda",
    season: "SS26",
    summary: {
      es: "El short largo de traje pasó su verano fuerte y empieza a ceder con el cambio de temporada.",
      en: "The long tailored short had its big summer and is now easing off with the season change.",
    },
    term: { es: "bermuda sastre", en: "tailored bermuda shorts" },
    synonyms: [
      "tailored bermuda",
      "bermuda shorts",
      "bermudas",
      "bermuda de sastre",
      "long shorts",
    ],
    target: "CAYENDO",
  },
  {
    id: "amarillo-mantequilla",
    name: { es: "Amarillo mantequilla", en: "Butter yellow" },
    category: "color",
    season: "SS26",
    summary: {
      es: "El pastel que dominó dos temporadas. Sigue en tienda, pero la conversación se enfrió.",
      en: "The pastel that owned two seasons. Still in store, but the conversation has cooled.",
    },
    term: { es: "amarillo mantequilla", en: "butter yellow" },
    synonyms: [
      "butter yellow",
      "amarillo mantequilla",
      "buttery yellow",
      "butter tone",
    ],
    swatch: "#F2E2A9",
    target: "CAYENDO",
  },
  {
    id: "burdeos-profundo",
    name: { es: "Burdeos profundo", en: "Deep burgundy" },
    category: "color",
    season: "FW26",
    summary: {
      es: "El neutro de invierno por excelencia. Saturado en editorial y en retail al mismo tiempo.",
      en: "The winter neutral of record. Saturated in editorial and retail at the same time.",
    },
    term: { es: "burdeos", en: "burgundy" },
    synonyms: [
      "burgundy",
      "burdeos",
      "deep burgundy",
      "vino tinto",
      "wine red",
      "bordeaux",
    ],
    swatch: "#6E2438",
    target: "PICO",
  },
  {
    id: "verde-matcha",
    name: { es: "Verde matcha", en: "Matcha green" },
    category: "color",
    season: "SS26",
    summary: {
      es: "Verde apagado con base gris. Se mueve de accesorio a prenda completa.",
      en: "Muted green with a grey base. Moving from accessories into full garments.",
    },
    term: { es: "verde matcha", en: "matcha green" },
    synonyms: [
      "matcha green",
      "verde matcha",
      "matcha",
      "pistachio green",
      "verde pistache",
    ],
    swatch: "#A7B89A",
    target: "SUBIENDO",
  },
  {
    id: "azul-polvo",
    name: { es: "Azul polvo", en: "Dusty powder blue" },
    category: "color",
    season: "SS26",
    summary: {
      es: "Azul empolvado de pasarela, todavía sin llegar a la masa. Señal temprana en Pinterest.",
      en: "Powdery runway blue, not yet mainstream. Early signal coming from Pinterest.",
    },
    term: { es: "azul polvo", en: "powder blue" },
    synonyms: ["powder blue", "azul polvo", "dusty blue", "azul empolvado"],
    swatch: "#A9BAD1",
    target: "EMERGIENDO",
  },
  {
    id: "marron-cacao",
    name: { es: "Marrón cacao", en: "Cocoa brown" },
    category: "color",
    season: "FW26",
    summary: {
      es: "El marrón profundo que reemplaza al negro en prendas de abrigo.",
      en: "The deep brown replacing black in outerwear.",
    },
    term: { es: "marron cacao", en: "cocoa brown" },
    synonyms: [
      "cocoa brown",
      "marron cacao",
      "chocolate brown",
      "mocha",
      "cafe chocolate",
    ],
    swatch: "#6B4A35",
    target: "SUBIENDO",
  },
  {
    id: "ante-cepillado",
    name: { es: "Ante cepillado", en: "Brushed suede" },
    category: "textura",
    season: "FW26",
    summary: {
      es: "Ante de tacto aterciopelado en chaquetas y botas. Nivel de exposición máximo.",
      en: "Velvety-touch suede in jackets and boots. Exposure is at its ceiling.",
    },
    term: { es: "ante cepillado", en: "brushed suede" },
    synonyms: ["brushed suede", "ante cepillado", "gamuza", "suede"],
    target: "PICO",
  },
  {
    id: "crochet-fino",
    name: { es: "Crochet fino", en: "Fine-gauge crochet" },
    category: "textura",
    season: "SS26",
    summary: {
      es: "Crochet de galga cerrada, lejos del artesanal. Crece de forma sostenida desde primavera.",
      en: "Tight-gauge crochet, far from the craft look. Growing steadily since spring.",
    },
    term: { es: "crochet fino", en: "fine crochet" },
    synonyms: ["crochet", "fine crochet", "crochet fino", "ganchillo"],
    target: "SUBIENDO",
  },
  {
    id: "lentejuela-mate",
    name: { es: "Lentejuela mate", en: "Matte sequin" },
    category: "textura",
    season: "FW26",
    summary: {
      es: "Brillo sin brillo: lentejuela opaca para diario. Señal incipiente de cara a fiestas.",
      en: "Shine without shine: opaque sequin for daytime. Early signal ahead of party season.",
    },
    term: { es: "lentejuela mate", en: "matte sequin" },
    synonyms: [
      "matte sequin",
      "lentejuela mate",
      "matte sequins",
      "lentejuelas",
    ],
    target: "EMERGIENDO",
  },
  {
    id: "borreguito-rizado",
    name: { es: "Borreguito rizado", en: "Curly faux shearling" },
    category: "textura",
    season: "FW26",
    summary: {
      es: "Pelo rizado sintético en chaquetas cortas y forros. Sube con cada bajada de temperatura.",
      en: "Curly synthetic pile in cropped jackets and linings. Rises with every drop in temperature.",
    },
    term: { es: "borreguito", en: "faux shearling" },
    synonyms: [
      "faux shearling",
      "borreguito",
      "curly shearling",
      "teddy coat",
      "shearling",
    ],
    target: "SUBIENDO",
  },
  {
    id: "hombro-estructurado",
    name: { es: "Hombro estructurado", en: "Structured shoulder" },
    category: "silueta",
    season: "FW26",
    summary: {
      es: "Vuelve la hombrera marcada, ahora en clave sastre y no ochentera.",
      en: "The defined shoulder pad is back, tailored rather than eighties.",
    },
    term: { es: "hombro estructurado", en: "structured shoulder blazer" },
    synonyms: [
      "structured shoulder",
      "hombro estructurado",
      "shoulder pads",
      "hombreras",
      "power shoulder",
    ],
    target: "SUBIENDO",
  },
  {
    id: "cintura-caida",
    name: { es: "Cintura caída", en: "Dropped waist" },
    category: "silueta",
    season: "SS26",
    summary: {
      es: "Talle bajo en vestidos y faldas. Máxima presencia en tienda; el interés ya no crece.",
      en: "Low waistline in dresses and skirts. Peak store presence; interest has stopped growing.",
    },
    term: { es: "vestido cintura caida", en: "drop waist dress" },
    synonyms: [
      "dropped waist",
      "cintura caida",
      "drop waist",
      "low waist",
      "talle bajo",
    ],
    target: "PICO",
  },
  {
    id: "linea-columna",
    name: { es: "Línea columna", en: "Column line" },
    category: "silueta",
    season: "FW26",
    summary: {
      es: "Silueta recta y estrecha de arriba abajo. Primeras señales fuera de la pasarela.",
      en: "Straight, narrow silhouette top to bottom. First signals outside the runway.",
    },
    term: { es: "vestido columna", en: "column dress" },
    synonyms: [
      "column dress",
      "linea columna",
      "column silhouette",
      "columna",
      "column line",
    ],
    target: "EMERGIENDO",
  },
  {
    id: "oversize-relajado",
    name: { es: "Oversize relajado", en: "Relaxed oversize" },
    category: "silueta",
    season: "SS26",
    summary: {
      es: "El volumen holgado cede terreno frente a las siluetas ceñidas de otoño.",
      en: "Loose volume is losing ground to autumn's closer silhouettes.",
    },
    term: { es: "camisa oversize", en: "oversized shirt" },
    synonyms: [
      "relaxed oversize",
      "oversize",
      "oversized fit",
      "corte holgado",
    ],
    target: "CAYENDO",
  },
  {
    id: "bolso-hobo-suave",
    name: { es: "Bolso hobo suave", en: "Slouchy hobo bag" },
    category: "accesorio",
    season: "FW26",
    summary: {
      es: "Bolso de hombro sin estructura, piel blanda. Ya está en todas las gamas de precio.",
      en: "Unstructured shoulder bag in soft leather. Already across every price tier.",
    },
    term: { es: "bolso hobo", en: "hobo bag" },
    synonyms: [
      "hobo bag",
      "bolso hobo",
      "slouchy bag",
      "bolsa hobo",
      "slouchy hobo",
    ],
    target: "PICO",
  },
  {
    id: "mary-jane-planas",
    name: { es: "Mary Jane planas", en: "Flat Mary Janes" },
    category: "accesorio",
    season: "SS26",
    summary: {
      es: "El zapato de correa perdió impulso tras dos temporadas en cabeza.",
      en: "The strap shoe lost momentum after two seasons in the lead.",
    },
    term: { es: "zapatos mary jane", en: "mary jane flats" },
    synonyms: [
      "mary jane",
      "mary janes",
      "mary jane flats",
      "zapatos mary jane",
    ],
    target: "CAYENDO",
  },
  {
    id: "cinturon-obi",
    name: { es: "Cinturón obi ancho", en: "Wide obi belt" },
    category: "accesorio",
    season: "FW26",
    summary: {
      es: "Faja ancha que se anuda sobre abrigos y vestidos. Arranque muy temprano.",
      en: "Wide sash tied over coats and dresses. Very early stage.",
    },
    term: { es: "cinturon obi", en: "obi belt" },
    synonyms: [
      "obi belt",
      "cinturon obi",
      "wide belt",
      "cinturon ancho",
      "faja obi",
    ],
    target: "EMERGIENDO",
  },
  {
    id: "gafas-cat-eye",
    name: { es: "Gafas cat eye", en: "Cat-eye sunglasses" },
    category: "accesorio",
    season: "SS26",
    summary: {
      es: "Montura felina y estrecha. Sustituye a la gafa deportiva envolvente.",
      en: "Narrow feline frame. Taking over from the wraparound sport lens.",
    },
    term: { es: "gafas cat eye", en: "cat eye sunglasses" },
    synonyms: [
      "cat eye sunglasses",
      "cat-eye",
      "gafas cat eye",
      "lentes cat eye",
      "cat eye frames",
    ],
    target: "SUBIENDO",
  },
  {
    id: "lujo-silencioso",
    name: { es: "Lujo silencioso", en: "Quiet luxury" },
    category: "estilo",
    season: "FW26",
    summary: {
      es: "El minimalismo caro se desgastó como etiqueta; el gasto se mueve a piezas con más carácter.",
      en: "Expensive minimalism is worn out as a label; spend is moving to pieces with more character.",
    },
    term: { es: "quiet luxury", en: "quiet luxury" },
    synonyms: [
      "quiet luxury",
      "lujo silencioso",
      "stealth wealth",
      "old money",
    ],
    target: "CAYENDO",
  },
  {
    id: "boho-renovado",
    name: { es: "Boho renovado", en: "Neo-boho" },
    category: "estilo",
    season: "SS26",
    summary: {
      es: "Bohemio depurado, sin folclore. Cobertura editorial y retail al máximo a la vez.",
      en: "Pared-back bohemian, no folklore. Editorial and retail coverage both maxed out.",
    },
    term: { es: "estilo boho", en: "boho style" },
    synonyms: ["boho", "neo boho", "boho chic", "bohemian", "boho renovado"],
    target: "PICO",
  },
  {
    id: "office-siren",
    name: { es: "Office siren", en: "Office siren" },
    category: "estilo",
    season: "SS26",
    summary: {
      es: "Secretaria de los noventa: camisa fina, falda lápiz, gafa estrecha. Crece desde social.",
      en: "Nineties secretary: sheer shirt, pencil skirt, narrow frames. Growing out of social.",
    },
    term: { es: "office siren", en: "office siren" },
    synonyms: ["office siren", "corpcore", "officecore", "secretary chic"],
    target: "SUBIENDO",
  },
];
