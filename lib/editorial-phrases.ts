import type { Localized } from "@/lib/types";

/**
 * Los números del catálogo, dichos como los diría una editora.
 *
 * En el terminal un +3.9 en una columna se lee de un vistazo porque está entre
 * otros veinticuatro y hay una cabecera encima que dice qué es. Suelto en una
 * página de revista no significa nada: hace falta la frase entera. Por eso
 * aquí no hay badges — "subiendo 3.9 puntos esta semana" es la misma
 * información y se lee sin traducir.
 *
 * Devuelven `Localized` porque son texto de dominio, y ese es el contrato.
 */

const one = (value: number) => Math.abs(value).toFixed(1);

/** Umbral por debajo del cual el movimiento es ruido y decirlo sería fingir. */
const FLAT = 0.2;

export function momentumPhrase(momentum7d: number): Localized {
  if (Math.abs(momentum7d) < FLAT) {
    return { es: "estable esta semana", en: "flat this week" };
  }
  if (momentum7d > 0) {
    return {
      es: `subiendo ${one(momentum7d)} puntos esta semana`,
      en: `up ${one(momentum7d)} points this week`,
    };
  }
  return {
    es: `cediendo ${one(momentum7d)} puntos esta semana`,
    en: `down ${one(momentum7d)} points this week`,
  };
}

export function yoyPhrase(yoyPct: number): Localized {
  const rounded = Math.round(yoyPct);
  if (rounded === 0) {
    return { es: "igual que hace un año", en: "level with a year ago" };
  }
  if (rounded > 0) {
    return {
      es: `un ${rounded}% por encima de hace un año`,
      en: `${rounded}% above a year ago`,
    };
  }
  return {
    es: `un ${Math.abs(rounded)}% por debajo de hace un año`,
    en: `${Math.abs(rounded)}% below a year ago`,
  };
}

export function risingPhrase(days: number): Localized {
  if (days <= 0) return { es: "", en: "" };
  if (days === 1) return { es: "lleva un día subiendo", en: "up for one day" };
  return {
    es: `lleva ${days} días subiendo`,
    en: `climbing for ${days} days`,
  };
}

export function sourcesPhrase(count: number, total: number): Localized {
  if (count === 1) {
    return {
      es: `lo confirma 1 de ${total} fuentes`,
      en: `confirmed by 1 of ${total} sources`,
    };
  }
  return {
    es: `lo confirman ${count} de ${total} fuentes`,
    en: `confirmed by ${count} of ${total} sources`,
  };
}

export function scorePhrase(score: number): Localized {
  return {
    es: `cotiza en ${score.toFixed(1)}`,
    en: `trading at ${score.toFixed(1)}`,
  };
}

/**
 * Une varias frases en una sola, con la puntuación del idioma. Se saltan las
 * vacías para que no queden comas huérfanas.
 */
export function joinPhrases(parts: Localized[]): Localized {
  const join = (lang: "es" | "en") => {
    const kept = parts.map((part) => part[lang]).filter(Boolean);
    if (!kept.length) return "";
    const text = kept.join(", ");
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  };
  return { es: join("es"), en: join("en") };
}
