import type { Db } from "@/lib/db/client";
import type { Trend } from "@/lib/types";

/**
 * Lo que un conector necesita de una tendencia para poder consultarla.
 *
 * No es `Trend` a propósito: una tendencia recién promovida no tiene
 * histórico, y aun así hay que preguntarle a Google y a Mercado Libre por ella
 * desde el primer día — si no, nunca juntaría los catorce días que necesita
 * para graduarse. Con id, nombre y keywords basta para consultar.
 */
export type ConnectorTrend = Pick<Trend, "id" | "name" | "keywords">;

/** Una lectura de una fuente externa, ya normalizada a 0–100. */
export type Reading = {
  trendId: string;
  /** Clave de la columna `source` en signals. */
  source: string;
  date: string;
  value: number;
};

export type CollectResult =
  | { status: "ok"; readings: Reading[] }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

export type Connector = {
  key: string;
  /**
   * Trae las lecturas del día. Nunca lanza: un fallo se devuelve como
   * `error` para que el cron siga con las demás fuentes.
   */
  collect(ctx: {
    db: Db;
    trends: ConnectorTrend[];
    date: string;
  }): Promise<CollectResult>;
};

/** Escala un conjunto de valores crudos a 0–100 respecto del mayor. */
export function normalizeToScale(
  values: Map<string, number>,
): Map<string, number> {
  const max = Math.max(...values.values(), 0);
  if (max <= 0) return new Map([...values.keys()].map((key) => [key, 0]));

  return new Map(
    [...values].map(([key, value]) => [
      key,
      Math.round(Math.min(100, Math.max(0, (value / max) * 100)) * 10) / 10,
    ]),
  );
}
