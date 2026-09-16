import type { OriginByDate } from "@/lib/db/catalog";

/**
 * Cómo se presenta la mezcla de señales mock y reales.
 *
 * CLAUDE.md: la UI nunca dibuja una línea continua que insinúe que todo se
 * midió igual. Cuando una serie tiene tramo mock y tramo real, el mock va
 * atenuado y se dice desde qué día hay dato real.
 */
export type OriginState = "mock" | "mixed" | "real";

export type OriginSummary = {
  state: OriginState;
  /** Primer día con dato real, o null si no hay ninguno. */
  firstRealDate: string | null;
  realDays: number;
  totalDays: number;
};

const empty: OriginSummary = {
  state: "mock",
  firstRealDate: null,
  realDays: 0,
  totalDays: 0,
};

export function summarizeOrigin(origins: OriginByDate | undefined): OriginSummary {
  if (!origins?.size) return empty;

  const dates = [...origins.keys()].sort();
  const reales = dates.filter((date) => origins.get(date) === "real");

  return {
    state: !reales.length ? "mock" : reales.length === dates.length ? "real" : "mixed",
    firstRealDate: reales[0] ?? null,
    realDays: reales.length,
    totalDays: dates.length,
  };
}

/**
 * Resumen de todo el catálogo. Una página solo deja de llevar la etiqueta
 * "Datos de muestra" cuando TODO lo que enseña es real: basta una tendencia
 * con un día mock para que siga siendo mixta.
 */
export function summarizeCatalog(
  origins: Map<string, OriginByDate>,
): OriginSummary {
  if (!origins.size) return empty;

  let realDays = 0;
  let totalDays = 0;
  let firstRealDate: string | null = null;
  let algunoMock = false;

  for (const byDate of origins.values()) {
    const summary = summarizeOrigin(byDate);
    realDays += summary.realDays;
    totalDays += summary.totalDays;
    if (summary.state !== "real") algunoMock = true;
    if (
      summary.firstRealDate &&
      (!firstRealDate || summary.firstRealDate < firstRealDate)
    ) {
      firstRealDate = summary.firstRealDate;
    }
  }

  return {
    state: !realDays ? "mock" : algunoMock ? "mixed" : "real",
    firstRealDate,
    realDays,
    totalDays,
  };
}

export type ChartRow = {
  date: string;
  /** Valor en el tramo mock, null fuera de él. */
  mock: number | null;
  /** Valor en el tramo real, null fuera de él. */
  real: number | null;
};

/**
 * Parte la serie en tramo mock y tramo real para dibujarlos distinto.
 *
 * El día del corte lleva valor en las dos columnas: si no, la línea se rompe
 * visualmente justo donde más importa que se entienda que es continua en el
 * tiempo aunque cambie el origen.
 *
 * Si no hay tramo real, devuelve null: atenuar una serie entera cuando todo
 * es mock no informa de nada, y para eso ya está la etiqueta de la cabecera.
 */
export function splitByOrigin(
  series: { date: string; score: number }[],
  origins: OriginByDate | undefined,
): { rows: ChartRow[]; firstRealDate: string } | null {
  if (!origins?.size) return null;

  const summary = summarizeOrigin(origins);
  if (summary.state !== "mixed" || !summary.firstRealDate) return null;

  const corte = summary.firstRealDate;
  const rows = series.map((point) => {
    const esReal = point.date >= corte;
    return {
      date: point.date,
      mock: esReal ? null : point.score,
      real: esReal ? point.score : null,
    };
  });

  // El último punto mock también es el primero de la línea real.
  const indiceCorte = rows.findIndex((row) => row.date === corte);
  if (indiceCorte > 0) rows[indiceCorte - 1].real = series[indiceCorte - 1].score;

  return { rows, firstRealDate: corte };
}
