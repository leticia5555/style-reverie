import type { Localized, TrendSummary } from "@/lib/types";

/**
 * Este módulo vive aparte de lib/insights.ts a propósito: lo importa un
 * componente cliente y aquí no puede entrar nada que toque la base ni el disco.
 * lib/insights.ts sí lee el catálogo, y arrastrarlo al bundle del navegador
 * rompe el build.
 */
/**
 * La línea de la ficha: qué está haciendo esta tendencia ahora mismo. Combina
 * la fase, el momentum y hacia dónde apunta la recta de los últimos 30 días.
 */
export function trendInsight(
  summary: TrendSummary,
  forecast: { target: number; fit: number } | null,
): Localized | null {
  const delta = forecast ? forecast.target - summary.score : 0;
  const move = Math.abs(delta).toFixed(1);
  // Con R² bajo la recta no describe nada y mejor no prometer un número.
  const trustworthy = forecast !== null && forecast.fit >= 0.7;

  if (summary.lifecycle === "PICO") {
    return {
      es: `Saturada: la llevan ${summary.sourceCount} de seis fuentes y el momentum ya se aplanó en ${summary.momentum7d.toFixed(1)}.`,
      en: `Saturated: carried by ${summary.sourceCount} of six sources, with momentum flattened at ${summary.momentum7d.toFixed(1)}.`,
    };
  }

  if (summary.lifecycle === "CAYENDO") {
    return trustworthy && delta < 0
      ? {
          es: `En descenso: pierde ${Math.abs(summary.momentum7d).toFixed(1)} puntos por semana y la recta la deja en ${forecast!.target.toFixed(1)} el domingo que viene.`,
          en: `On the way down: losing ${Math.abs(summary.momentum7d).toFixed(1)} points a week, and the line puts it at ${forecast!.target.toFixed(1)} by next Sunday.`,
        }
      : {
          es: `En descenso: pierde ${Math.abs(summary.momentum7d).toFixed(1)} puntos por semana.`,
          en: `On the way down: losing ${Math.abs(summary.momentum7d).toFixed(1)} points a week.`,
        };
  }

  const phase =
    summary.lifecycle === "EMERGIENDO"
      ? { es: "Todavía nicho", en: "Still niche" }
      : { es: "En ascenso", en: "Climbing" };

  return trustworthy
    ? {
        es: `${phase.es}: ${summary.sourceCount} de seis fuentes la confirman y la recta suma ${move} puntos en siete días.`,
        en: `${phase.en}: ${summary.sourceCount} of six sources confirm it, and the line adds ${move} points over seven days.`,
      }
    : {
        es: `${phase.es}: ${summary.sourceCount} de seis fuentes la confirman, pero la curva viene demasiado irregular para proyectarla.`,
        en: `${phase.en}: ${summary.sourceCount} of six sources confirm it, but the curve is too irregular to project.`,
      };
}
