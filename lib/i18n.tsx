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
  "detail.notFound": { es: "Tendencia no encontrada", en: "Trend not found" },
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
