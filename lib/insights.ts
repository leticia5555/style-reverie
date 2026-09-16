import { getAlerts, getTrends, historyDates, summaryAsOf, toSummary } from "@/lib/trends";
import type { Trend } from "@/lib/types";
import type { Lifecycle, Localized, TrendSummary } from "@/lib/types";
import { LIFECYCLES } from "@/lib/types";

/**
 * Cifras y línea editorial de cada página. Todo sale del catálogo: ninguna de
 * estas frases está escrita a mano, se arman con los números del día. Si el
 * dato cambia, la frase cambia.
 */
export type Figure = {
  value: string;
  label: Localized;
  /** Ciclo de vida al que pertenece la cifra, para teñirla. */
  tone?: Lifecycle;
};

export type Insight = {
  figures: Figure[];
  line: Localized | null;
};

const WEEK = 7;

/** Fecha de hace una semana dentro del histórico. */
function weekAgoDate(trends: Trend[]): string {
  const dates = historyDates(trends);
  return dates[Math.max(0, dates.length - 1 - WEEK)];
}

type Movement = {
  summary: TrendSummary;
  before: Lifecycle;
  after: Lifecycle;
};

/** Tendencias que cambiaron de fase en los últimos siete días. */
export function weeklyMovements(trends: Trend[] = getTrends()): Movement[] {
  const past = weekAgoDate(trends);
  return trends
    .map((trend) => {
      const after = toSummary(trend);
      const before = summaryAsOf(trend, past);
      if (!before || before.lifecycle === after.lifecycle) return null;
      return { summary: after, before: before.lifecycle, after: after.lifecycle };
    })
    .filter((move): move is Movement => Boolean(move));
}

export function lifecycleCounts(
  trends: Trend[] = getTrends(),
): Record<Lifecycle, number> {
  const counts = Object.fromEntries(
    LIFECYCLES.map((key) => [key, 0]),
  ) as Record<Lifecycle, number>;
  for (const trend of trends) counts[toSummary(trend).lifecycle] += 1;
  return counts;
}

const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : many;

/* ── /trending ─────────────────────────────────────────────────────── */

export function trendingInsight(trends: Trend[] = getTrends()): Insight {
  const counts = lifecycleCounts(trends);
  const moves = weeklyMovements(trends);
  const toPeak = moves.filter((move) => move.after === "PICO");
  const toFalling = moves.filter((move) => move.after === "CAYENDO");

  const figures: Figure[] = [
    { value: String(counts.SUBIENDO), label: { es: "subiendo", en: "rising" }, tone: "SUBIENDO" },
    { value: String(counts.EMERGIENDO), label: { es: "emergiendo", en: "emerging" }, tone: "EMERGIENDO" },
    { value: String(counts.PICO), label: { es: "en pico", en: "at peak" }, tone: "PICO" },
    { value: String(counts.CAYENDO), label: { es: "cayendo", en: "falling" }, tone: "CAYENDO" },
  ];

  let line: Localized | null = null;
  if (toPeak.length) {
    const names = toPeak.map((move) => move.summary.name);
    line = {
      es: `Esta semana ${names.length === 1 ? `${names[0].es} cruzó` : `${names.length} tendencias cruzaron`} a pico${
        toFalling.length
          ? ` y ${toFalling.length} ${plural(toFalling.length, "entró", "entraron")} en caída`
          : ""
      }.`,
      en: `This week ${names.length === 1 ? `${names[0].en} crossed` : `${names.length} trends crossed`} into peak${
        toFalling.length
          ? ` and ${toFalling.length} started falling`
          : ""
      }.`,
    };
  } else if (moves.length) {
    line = {
      es: `${moves.length} ${plural(moves.length, "tendencia cambió", "tendencias cambiaron")} de fase esta semana; ninguna llegó al pico.`,
      en: `${moves.length} ${plural(moves.length, "trend changed", "trends changed")} phase this week; none reached peak.`,
    };
  } else {
    line = {
      es: "Ninguna tendencia cambió de fase esta semana: el catálogo está quieto.",
      en: "No trend changed phase this week: the catalog is holding still.",
    };
  }

  return { figures, line };
}

/* ── /alerts ───────────────────────────────────────────────────────── */

export function alertsInsight(trends: Trend[] = getTrends()): Insight {
  const alerts = getAlerts(trends);
  const top = alerts[0];

  const figures: Figure[] = [
    { value: String(alerts.length), label: { es: "en alerta", en: "on alert" }, tone: "EMERGIENDO" },
    {
      value: top ? `+${top.momentum7d.toFixed(1)}` : "—",
      label: { es: "mayor momentum", en: "top momentum" },
    },
    {
      // La racha de la misma tendencia que nombra la línea, no el máximo del
      // grupo: si no, la cifra y la frase hablan de dos tendencias distintas.
      value: top ? String(top.risingDays) : "—",
      label: { es: "días de racha", en: "days climbing" },
    },
  ];

  const line: Localized | null = top
    ? {
        es: `${top.name.es} es la que más corre: ${top.risingDays} días subiendo y todavía en ${top.score.toFixed(1)}.`,
        en: `${top.name.en} is moving fastest: ${top.risingDays} days climbing and still at ${top.score.toFixed(1)}.`,
      }
    : {
        es: "Nada cruza el umbral hoy. Vuelve el domingo.",
        en: "Nothing clears the threshold today. Check back Sunday.",
      };

  return { figures, line };
}

/* ── /paleta ───────────────────────────────────────────────────────── */

/**
 * Compara el ranking de colores de hoy con el de hace una semana. Si alguno
 * adelantó a otro, esa es la frase; es literalmente "el sage le ganó al matcha".
 */
export function paletaInsight(trends: Trend[] = getTrends()): Insight {
  const colors = trends.filter((trend) => trend.category === "color");
  const now = colors
    .map((trend) => toSummary(trend))
    .sort((a, b) => b.score - a.score);

  const past = weekAgoDate(trends);
  const before = colors
    .map((trend) => summaryAsOf(trend, past))
    .filter((summary): summary is TrendSummary => Boolean(summary))
    .sort((a, b) => b.score - a.score);

  const rankBefore = new Map(before.map((summary, index) => [summary.id, index]));

  const overtake = now
    .map((summary, index) => ({
      summary,
      gained: (rankBefore.get(summary.id) ?? index) - index,
    }))
    .filter((entry) => entry.gained > 0)
    .sort((a, b) => b.gained - a.gained)[0];

  const leader = now[0];
  const fastest = [...now].sort((a, b) => b.momentum7d - a.momentum7d)[0];

  const figures: Figure[] = [
    { value: String(now.length), label: { es: "colores", en: "colors" } },
    {
      // "por score" explícito: el bloque de color de temporada ordena por
      // score Y momentum y puede encabezarlo otro color. Sin decir según qué,
      // la página muestra dos líderes distintos y parece un error.
      value: leader.score.toFixed(1),
      label: {
        es: `${leader.name.es.toLowerCase()}, el más alto por score`,
        en: `${leader.name.en.toLowerCase()}, highest by score`,
      },
    },
    {
      value: `${fastest.momentum7d > 0 ? "+" : ""}${fastest.momentum7d.toFixed(1)}`,
      label: { es: "mejor semana", en: "best week" },
      tone: fastest.lifecycle,
    },
  ];

  let line: Localized;
  if (overtake) {
    // A quién adelantó: el que ahora está justo debajo.
    const index = now.findIndex((s) => s.id === overtake.summary.id);
    const passed = now[index + 1];
    line = passed
      ? {
          es: `Esta semana ${overtake.summary.name.es.toLowerCase()} le ganó a ${passed.name.es.toLowerCase()}.`,
          en: `This week ${overtake.summary.name.en.toLowerCase()} overtook ${passed.name.en.toLowerCase()}.`,
        }
      : {
          es: `${overtake.summary.name.es} subió ${overtake.gained} ${plural(overtake.gained, "puesto", "puestos")} esta semana.`,
          en: `${overtake.summary.name.en} climbed ${overtake.gained} ${plural(overtake.gained, "place", "places")} this week.`,
        };
  } else {
    line = {
      es: `El orden no se movió: ${leader.name.es.toLowerCase()} sigue arriba y ${fastest.name.es.toLowerCase()} es el que más gana, ${fastest.momentum7d.toFixed(1)} puntos.`,
      en: `The order held: ${leader.name.en.toLowerCase()} stays on top and ${fastest.name.en.toLowerCase()} gains the most, ${fastest.momentum7d.toFixed(1)} points.`,
    };
  }

  return { figures, line };
}

/* ── /edicion ──────────────────────────────────────────────────────── */

export function edicionInsight(picks: {
  summary: TrendSummary;
  risingDays: number;
}[]): Insight {
  if (!picks.length) return { figures: [], line: null };

  const best = [...picks].sort(
    (a, b) => b.summary.momentum7d - a.summary.momentum7d,
  )[0];
  const longest = [...picks].sort((a, b) => b.risingDays - a.risingDays)[0];
  const emerging = picks.filter(
    (pick) => pick.summary.lifecycle === "EMERGIENDO",
  ).length;

  return {
    figures: [
      { value: String(picks.length), label: { es: "piezas", en: "picks" } },
      {
        value: String(emerging),
        label: { es: "todavía nicho", en: "still niche" },
        tone: "EMERGIENDO",
      },
      {
        value: `+${best.summary.momentum7d.toFixed(1)}`,
        label: { es: "mayor momentum", en: "top momentum" },
      },
    ],
    line: {
      es: `${longest.summary.name.es} es la más paciente de la lista: ${longest.risingDays} días subiendo sin parar.`,
      en: `${longest.summary.name.en} is the most patient on the list: ${longest.risingDays} days climbing without a break.`,
    },
  };
}

/* ── /editorial ────────────────────────────────────────────────────── */

export function editorialInsight(
  articleCount: number,
  matchedCount: number,
  mentions: { name: Localized; count: number }[],
  sourcesOk: number,
  sourcesTotal: number,
): Insight {
  const figures: Figure[] = [
    { value: String(articleCount), label: { es: "titulares", en: "headlines" } },
    { value: String(matchedCount), label: { es: "citan una tendencia", en: "cite a trend" } },
    { value: `${sourcesOk}/${sourcesTotal}`, label: { es: "fuentes vivas", en: "sources live" } },
  ];

  if (!articleCount) {
    return {
      figures,
      line: {
        es: "El feed todavía no se ha traído. Corre npm run editorial.",
        en: "The feed has not been pulled yet. Run npm run editorial.",
      },
    };
  }

  const top = mentions[0];
  return {
    figures,
    line: top
      ? {
          es: `${top.name.es} es de lo que más se escribe: ${top.count} ${plural(top.count, "titular", "titulares")} esta tanda.`,
          en: `${top.name.en} is the most written about: ${top.count} ${plural(top.count, "headline", "headlines")} this batch.`,
        }
      : {
          es: "Ningún titular de esta tanda menciona una tendencia del catálogo.",
          en: "No headline in this batch mentions a catalog trend.",
        },
  };
}

/* ── /fashion-week y /ocasiones ────────────────────────────────────── */

export function fashionWeekInsight(
  collections: { looks: unknown[]; trends: TrendSummary[] }[],
): Insight {
  const looks = collections.reduce((acc, c) => acc + c.looks.length, 0);
  const trends = [...new Set(collections.flatMap((c) => c.trends.map((t) => t.id)))];
  const all = collections.flatMap((c) => c.trends);
  const top = [...all].sort((a, b) => b.score - a.score)[0];

  return {
    figures: [
      { value: String(collections.length), label: { es: "colecciones", en: "collections" } },
      { value: String(looks), label: { es: "looks clave", en: "key looks" } },
      { value: String(trends.length), label: { es: "tendencias tocadas", en: "trends moved" } },
    ],
    line: top
      ? {
          es: `Lo que mejor envejeció de la pasarela: ${top.name.es.toLowerCase()}, hoy en ${top.score.toFixed(1)}.`,
          en: `What aged best off the runway: ${top.name.en.toLowerCase()}, today at ${top.score.toFixed(1)}.`,
        }
      : null,
  };
}

export function ocasionesInsight(
  ocasiones: { trends: { summary: TrendSummary }[]; pieces: unknown[] }[],
): Insight {
  const all = ocasiones.flatMap((o) => o.trends.map((t) => t.summary));
  const unique = [...new Set(all.map((t) => t.id))];
  const pieces = ocasiones.reduce((acc, o) => acc + o.pieces.length, 0);

  // La que aparece en más ocasiones: la prenda que más veces resuelve.
  const counts = new Map<string, { summary: TrendSummary; count: number }>();
  for (const summary of all) {
    const entry = counts.get(summary.id);
    if (entry) entry.count += 1;
    else counts.set(summary.id, { summary, count: 1 });
  }
  const versatile = [...counts.values()].sort((a, b) => b.count - a.count)[0];

  return {
    figures: [
      { value: String(ocasiones.length), label: { es: "ocasiones", en: "occasions" } },
      { value: String(unique.length), label: { es: "tendencias", en: "trends" } },
      { value: String(pieces), label: { es: "prendas", en: "pieces" } },
    ],
    line:
      versatile && versatile.count > 1
        ? {
            es: `${versatile.summary.name.es} es la más versátil: sirve en ${versatile.count} de las ${ocasiones.length} ocasiones.`,
            en: `${versatile.summary.name.en} is the most versatile: it works for ${versatile.count} of the ${ocasiones.length} occasions.`,
          }
        : null,
  };
}

/* ── /compare ──────────────────────────────────────────────────────── */

/**
 * Busca si las dos curvas se cruzaron en los 90 días. Un cruce es la historia
 * de la comparación; sin él, la distancia de hoy.
 */
export function compareInsight(
  a: TrendSummary,
  b: TrendSummary,
  series: { date: string; a: number; b: number }[],
): Insight {
  const gap = Math.abs(a.score - b.score);
  const ahead = a.score >= b.score ? a : b;
  const behind = a.score >= b.score ? b : a;

  let crossIndex = -1;
  for (let i = series.length - 1; i > 0; i -= 1) {
    const now = series[i].a - series[i].b;
    const prev = series[i - 1].a - series[i - 1].b;
    if (now === 0 || now * prev < 0) {
      crossIndex = i;
      break;
    }
  }
  const daysSinceCross = crossIndex >= 0 ? series.length - 1 - crossIndex : -1;

  return {
    figures: [
      { value: gap.toFixed(1), label: { es: "de diferencia", en: "point gap" } },
      {
        value: `${ahead.momentum7d > 0 ? "+" : ""}${ahead.momentum7d.toFixed(1)}`,
        label: { es: `momentum de ${ahead.name.es.toLowerCase()}`, en: `${ahead.name.en.toLowerCase()} momentum` },
        tone: ahead.lifecycle,
      },
      {
        value: daysSinceCross >= 0 ? String(daysSinceCross) : "—",
        label: { es: "días desde el cruce", en: "days since crossing" },
      },
    ],
    line:
      daysSinceCross >= 0
        ? {
            es: `Se cruzaron hace ${daysSinceCross} ${plural(daysSinceCross, "día", "días")}: ${ahead.name.es.toLowerCase()} pasó a ${behind.name.es.toLowerCase()} y no ha mirado atrás.`,
            en: `They crossed ${daysSinceCross} ${plural(daysSinceCross, "day", "days")} ago: ${ahead.name.en.toLowerCase()} passed ${behind.name.en.toLowerCase()} and has not looked back.`,
          }
        : {
            es: `Sin cruces en 90 días: ${ahead.name.es.toLowerCase()} lleva la delantera todo el trimestre.`,
            en: `No crossing in 90 days: ${ahead.name.en.toLowerCase()} has led the whole quarter.`,
          },
  };
}
