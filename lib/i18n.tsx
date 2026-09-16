"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Lang = "es" | "en";

/** Español por default; el toggle recuerda la elección en el navegador. */
export const DEFAULT_LANG: Lang = "es";
const STORAGE_KEY = "style-reverie.lang";

export type Localized = { es: string; en: string };

const dict = {
  "brand.name": { es: "Style Reverie", en: "Style Reverie" },
  "brand.tagline": {
    es: "Inteligencia de tendencias de moda",
    en: "Fashion trend intelligence",
  },
  "nav.section": { es: "Terminal", en: "Terminal" },
  "nav.sectionSoon": { es: "Próximamente", en: "Coming soon" },
  "nav.sectionEdicion": { es: "Edición", en: "Edition" },
  "nav.trending": { es: "Tendencias", en: "Trending" },
  "nav.editorial": { es: "Feed editorial", en: "Editorial feed" },
  "nav.compare": { es: "Comparador", en: "Compare" },
  "nav.heatmap": { es: "Mapa de calor", en: "Heatmap" },
  "nav.alerts": { es: "Alertas", en: "Alerts" },
  "badge.sample": { es: "Datos de muestra", en: "Sample data" },
  "badge.sampleLong": {
    es: "Datos de muestra — no son señales reales de mercado",
    en: "Sample data — not real market signals",
  },
  "lang.toggle": { es: "Idioma", en: "Language" },
  "common.all": { es: "Todas", en: "All" },
  "common.category": { es: "Categoría", en: "Category" },
  "common.lifecycle": { es: "Ciclo de vida", en: "Lifecycle" },
  "common.score": { es: "Score", en: "Score" },
  "common.momentum7d": { es: "Momentum 7d", en: "7d momentum" },
  "common.yoy": { es: "Var. anual", en: "YoY" },
  "common.sources": { es: "Fuentes", en: "Sources" },
  "common.season": { es: "Temporada", en: "Season" },
  "common.updated": { es: "Actualizado", en: "Updated" },
  "common.search": { es: "Buscar tendencia", en: "Search trend" },
  "common.reset": { es: "Limpiar filtros", en: "Clear filters" },
  "trending.title": { es: "Tendencias", en: "Trending" },
  "trending.subtitle": {
    es: "25 tendencias SS26/FW26 ordenadas por score compuesto.",
    en: "25 SS26/FW26 trends ranked by composite score.",
  },
  "trending.count": { es: "tendencias", en: "trends" },
  "trending.empty": {
    es: "Ninguna tendencia coincide con estos filtros.",
    en: "No trend matches these filters.",
  },
  "trending.emptyHint": {
    es: "Prueba con otra categoría o limpia la búsqueda.",
    en: "Try another category or clear the search.",
  },
  "trending.trend": { es: "Tendencia", en: "Trend" },
  "detail.back": { es: "Volver a tendencias", en: "Back to trending" },
  "detail.momentum": { es: "Momentum 90 días", en: "90-day momentum" },
  "detail.momentumNote": {
    es: "Score compuesto diario, 0–100.",
    en: "Daily composite score, 0–100.",
  },
  "detail.breakdown": { es: "Desglose por fuente", en: "Source breakdown" },
  "detail.breakdownNote": {
    es: "El score es el promedio ponderado de estas señales.",
    en: "The score is the weighted average of these signals.",
  },
  "detail.source": { es: "Fuente", en: "Source" },
  "detail.signal": { es: "Señal", en: "Signal" },
  "detail.weight": { es: "Peso", en: "Weight" },
  "detail.contribution": { es: "Aporte", en: "Contribution" },
  "detail.change7d": { es: "Δ 7d", en: "Δ 7d" },
  "detail.shop": { es: "Dónde comprarlo", en: "Where to buy" },
  "detail.shopNote": {
    es: "Tres niveles de precio por tendencia.",
    en: "Three price tiers per trend.",
  },
  "detail.budget": { es: "Budget", en: "Budget" },
  "detail.mid": { es: "Mid", en: "Mid" },
  "detail.invest": { es: "Invest", en: "Invest" },
  "detail.peak": { es: "Máximo 90d", en: "90d high" },
  "detail.low": { es: "Mínimo 90d", en: "90d low" },
  "detail.forecast": { es: "Estimación 7d", en: "7d estimate" },
  "detail.forecastNote": {
    es: "regresión lineal sobre los últimos 30 días",
    en: "linear regression over the last 30 days",
  },
  "detail.notFound": { es: "Tendencia no encontrada", en: "Trend not found" },
  "compare.title": { es: "Comparador", en: "Compare" },
  "compare.subtitle": {
    es: "Dos tendencias sobre el mismo eje: score, ciclo de vida y señal por fuente.",
    en: "Two trends on one axis: score, lifecycle and signal by source.",
  },
  "compare.trendA": { es: "Tendencia A", en: "Trend A" },
  "compare.trendB": { es: "Tendencia B", en: "Trend B" },
  "compare.swap": { es: "Intercambiar A y B", en: "Swap A and B" },
  "compare.series": { es: "Momentum 90 días", en: "90-day momentum" },
  "compare.signals": { es: "Señal por fuente", en: "Signal by source" },
  "compare.signalsNote": {
    es: "Valor de hoy en cada fuente, 0–100.",
    en: "Today's value per source, 0–100.",
  },
  "compare.gap": { es: "Diferencia", en: "Gap" },
  "compare.sameTrend": {
    es: "Elige dos tendencias distintas para comparar.",
    en: "Pick two different trends to compare.",
  },
  "compare.openDetail": { es: "Ver ficha", en: "View detail" },
  "alerts.title": { es: "Alertas de emergentes", en: "Emerging alerts" },
  "alerts.subtitle": {
    es: "Tendencias que suben fuerte y todavía no son masivas.",
    en: "Trends climbing fast that are not mainstream yet.",
  },
  "alerts.rule": {
    es: "Regla: momentum 7d de 3 puntos o más y score por debajo de 60.",
    en: "Rule: 7d momentum of 3 points or more and score below 60.",
  },
  "alerts.rising": { es: "Subiendo desde hace", en: "Rising for" },
  "alerts.days": { es: "días", en: "days" },
  "alerts.fromScore": { es: "desde score", en: "from score" },
  "alerts.empty": {
    es: "Ninguna tendencia cumple la regla hoy.",
    en: "No trend meets the rule today.",
  },
  "alerts.watchlist": { es: "En observación", en: "Watchlist" },
  "alerts.watchlistNote": {
    es: "Suben y siguen por debajo de 60, pero aún no llegan a 3 puntos de momentum.",
    en: "Climbing and still under 60, but not yet at 3 points of momentum.",
  },
  "alerts.count": { es: "en alerta", en: "on alert" },
  "badge.live": { es: "Fuentes reales", en: "Live sources" },
  "badge.liveLong": {
    es: "Titulares traídos por RSS de los medios, no datos de muestra",
    en: "Headlines pulled by RSS from the outlets, not sample data",
  },
  "editorial.title": { es: "Feed editorial", en: "Editorial feed" },
  "editorial.subtitle": {
    es: "Titulares de Vogue, WWD, Business of Fashion y Who What Wear, con las tendencias que menciona cada uno.",
    en: "Headlines from Vogue, WWD, Business of Fashion and Who What Wear, tagged with the trends each one mentions.",
  },
  "editorial.fetchedAt": { es: "Traído", en: "Fetched" },
  "editorial.never": { es: "sin traer todavía", en: "not fetched yet" },
  "editorial.refreshNote": {
    es: "El feed se refresca como máximo una vez por hora.",
    en: "The feed refreshes at most once an hour.",
  },
  "editorial.sources": { es: "Fuentes", en: "Sources" },
  "editorial.mentions": { es: "Más mencionadas", en: "Most mentioned" },
  "editorial.mentionsNote": {
    es: "Tendencias del catálogo detectadas en los titulares de este feed.",
    en: "Catalog trends detected in this feed's headlines.",
  },
  "editorial.noMentions": {
    es: "Ningún titular menciona una tendencia del catálogo.",
    en: "No headline mentions a catalog trend.",
  },
  "editorial.matchNote": {
    es: "Los titulares son reales; las tendencias con las que se cruzan siguen siendo el catálogo de muestra.",
    en: "Headlines are real; the trends they are matched against are still the sample catalog.",
  },
  "editorial.empty": {
    es: "Todavía no hay titulares guardados.",
    en: "No headlines stored yet.",
  },
  "editorial.emptyHow": {
    es: "Corre npm run editorial para traer los feeds y guardar el caché.",
    en: "Run npm run editorial to pull the feeds and write the cache.",
  },
  "editorial.onlyMatched": {
    es: "Solo con tendencia detectada",
    en: "Only with a detected trend",
  },
  "editorial.articles": { es: "titulares", en: "headlines" },
  "editorial.failed": { es: "sin respuesta", en: "no response" },
  "nav.edicion": { es: "Edición semanal", en: "Weekly edition" },
  "nav.fashionWeek": { es: "Fashion Week", en: "Fashion Week" },
  "nav.ocasiones": { es: "Ocasiones", en: "Occasions" },
  "nav.paleta": { es: "Paleta", en: "Palette" },
  "edicion.title": { es: "Edición semanal", en: "Weekly edition" },
  "edicion.subtitle": {
    es: "Cinco prendas para comprar esta semana, con la razón por la que es ahora y no en tres meses.",
    en: "Five pieces to buy this week, with the reason it is now and not in three months.",
  },
  "edicion.of": { es: "Edición del", en: "Edition of" },
  "edicion.whyNow": { es: "Por qué ahora", en: "Why now" },
  "edicion.archive": { es: "Ediciones anteriores", en: "Past editions" },
  "edicion.archiveNote": {
    es: "Cada edición se calcula con el estado del catálogo de esa semana, no con el de hoy.",
    en: "Each edition is computed from that week's catalog state, not today's.",
  },
  "edicion.curated": { es: "Curada", en: "Curated" },
  "edicion.auto": { es: "Automática", en: "Automatic" },
  "edicion.current": { es: "Edición actual", en: "Current edition" },
  "edicion.backToCurrent": { es: "Ver la edición actual", en: "Back to current edition" },
  "edicion.frozen": { es: "Publicada", en: "Published" },
  "edicion.frozenLong": {
    es: "Congelada en la base el domingo que se publicó; ya no se recalcula.",
    en: "Frozen in the database the Sunday it was published; no longer recomputed.",
  },
  "edicion.pick": { es: "Pieza", en: "Pick" },
  "edicion.risingDays": { es: "días subiendo", en: "days climbing" },
  "fw.title": { es: "Inteligencia Fashion Week", en: "Fashion Week intelligence" },
  "fw.subtitle": {
    es: "Qué salió en pasarela, qué tendencia del catálogo mueve y qué se puede comprar ya.",
    en: "What walked the runway, which catalog trend it moves, and what you can buy now.",
  },
  "fw.looks": { es: "Looks clave", en: "Key looks" },
  "fw.look": { es: "Salida", en: "Look" },
  "fw.palette": { es: "Paleta de la colección", en: "Collection palette" },
  "fw.shop": { es: "Comprarlo ahora", en: "Buy it now" },
  "fw.shopNote": {
    es: "Tres piezas inspiradas en la colección, una por nivel.",
    en: "Three pieces inspired by the collection, one per tier.",
  },
  "fw.trends": { es: "Tendencias que toca", en: "Trends it moves" },
  "fw.designer": { es: "Dirección creativa", en: "Creative direction" },
  "fw.collections": { es: "Colecciones", en: "Collections" },
  "fw.back": { es: "Volver a Fashion Week", en: "Back to Fashion Week" },
  "fw.curated": {
    es: "Contenido curado a mano. Los scores de las tendencias enlazadas sí salen del catálogo.",
    en: "Hand-curated content. The scores of the linked trends do come from the catalog.",
  },
  "oc.title": { es: "Inteligencia por ocasión", en: "Occasion intelligence" },
  "oc.subtitle": {
    es: "Qué del catálogo aplica a dónde vas, y qué conviene dejar en casa.",
    en: "What in the catalog applies to where you are going, and what to leave at home.",
  },
  "oc.trends": { es: "Tendencias que aplican", en: "Trends that apply" },
  "oc.pieces": { es: "Prendas", en: "Pieces" },
  "oc.avoid": { es: "Qué evitar", en: "What to avoid" },
  "oc.back": { es: "Volver a ocasiones", en: "Back to occasions" },
  "oc.curated": {
    es: "Selección curada a mano. Los scores y los ciclos de vida salen del catálogo.",
    en: "Hand-curated selection. Scores and lifecycles come from the catalog.",
  },
  "oc.count": { es: "tendencias", en: "trends" },
  "paleta.title": { es: "Paleta de temporada", en: "Season palette" },
  "paleta.subtitle": {
    es: "Los colores del catálogo ordenados por score, con su fase y con qué combinan.",
    en: "Catalog colors ranked by score, with their phase and what they pair with.",
  },
  "paleta.pairs": { es: "Combina con", en: "Pairs with" },
  "paleta.pairsNote": {
    es: "Las combinaciones son curadas a mano, en content/paleta/. Los scores y los ciclos de vida sí salen del catálogo.",
    en: "Pairings are hand-curated, in content/paleta/. Scores and lifecycles do come from the catalog.",
  },
  "paleta.noPairs": {
    es: "Su archivo no tiene combinaciones válidas.",
    en: "Its file has no valid pairings.",
  },
  "paleta.uncurated": {
    es: "Todavía sin combinaciones curadas.",
    en: "No curated pairings yet.",
  },
  "paleta.strip": { es: "La temporada de un vistazo", en: "The season at a glance" },
  "origin.mockSegment": { es: "tramo de muestra", en: "sample segment" },
  "origin.realSince": { es: "datos reales desde", en: "real data since" },
  "origin.mockPoint": { es: "dato de muestra", en: "sample data" },
  "badge.mixed": { es: "Datos parciales", en: "Partial data" },
  "badge.mixedLong": {
    es: "Parte del histórico son datos de muestra; la gráfica marca dónde empieza el dato real",
    en: "Part of the history is sample data; the chart marks where real data starts",
  },
  "pinterest.title": { es: "Señal Pinterest hoy", en: "Pinterest signal today" },
  "pinterest.note": {
    es: "Lectura en vivo, región México. No se guarda: no hay histórico de Pinterest.",
    en: "Live read, Mexico region. Not stored: there is no Pinterest history.",
  },
  "pinterest.strength": { es: "Fuerza", en: "Strength" },
  "pinterest.rank": { es: "Puesto en México", en: "Rank in Mexico" },
  "pinterest.keyword": { es: "Término", en: "Keyword" },
  "pinterest.noMatch": {
    es: "Hoy esta tendencia no aparece en el ranking de Pinterest México.",
    en: "This trend is not in today's Pinterest Mexico ranking.",
  },
  "lifecycle.EMERGIENDO": { es: "Emergiendo", en: "Emerging" },
  "lifecycle.SUBIENDO": { es: "Subiendo", en: "Rising" },
  "lifecycle.PICO": { es: "Pico", en: "Peak" },
  "lifecycle.CAYENDO": { es: "Cayendo", en: "Falling" },
  "category.prenda": { es: "Prenda", en: "Garment" },
  "category.color": { es: "Color", en: "Color" },
  "category.textura": { es: "Textura", en: "Texture" },
  "category.silueta": { es: "Silueta", en: "Silhouette" },
  "category.accesorio": { es: "Accesorio", en: "Accessory" },
  "category.estilo": { es: "Estilo", en: "Style" },
  "source.google_trends": { es: "Google Trends", en: "Google Trends" },
  "source.mercadolibre": { es: "Mercado Libre", en: "Mercado Libre" },
  "source.pinterest": { es: "Pinterest", en: "Pinterest" },
  "source.tiktok": { es: "TikTok", en: "TikTok" },
  "source.instagram": { es: "Instagram", en: "Instagram" },
  "source.editorial": { es: "Editorial", en: "Editorial" },
  "source.amazon": { es: "Amazon", en: "Amazon" },
} satisfies Record<string, Localized>;

export type TranslationKey = keyof typeof dict;

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  pick: (value: Localized) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * El idioma vive en localStorage, fuera de React: el servidor siempre renderiza
 * en español y el cliente se sincroniza con la preferencia guardada.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "es" || stored === "en" ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function storeLang(next: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Navegación privada o storage bloqueado: el idioma dura la sesión.
  }
  for (const listener of listeners) listener();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(
    subscribe,
    readStoredLang,
    () => DEFAULT_LANG,
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => storeLang(next), []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key) => dict[key][lang],
      pick: (value) => value[lang],
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return ctx;
}
