import { getDb } from "@/lib/db/client";
import { finishRun, startRun, writeReadings } from "@/lib/db/runs";
import type { Connector } from "@/lib/sources/types";
import { getCatalog } from "@/lib/trends";

export type SourceOutcome = {
  source: string;
  status: "ok" | "error" | "skipped";
  rowsWritten: number;
  detail?: string;
};

export type CronOutcome = {
  date: string;
  ran: SourceOutcome[];
  /** true si alguna fuente falló; el cron sigue devolviendo 200. */
  hadErrors: boolean;
};

/**
 * Corre las fuentes una por una y registra cada corrida.
 *
 * Una fuente caída nunca aborta el resto: su error queda en signal_runs y el
 * cron sigue. Devolver un 500 por una fuente haría que Vercel reintentara
 * todo, incluidas las que ya escribieron bien.
 */
export async function runDaily(
  connectors: Connector[],
  date = new Date().toISOString().slice(0, 10),
): Promise<CronOutcome> {
  const db = getDb();
  if (!db) {
    return {
      date,
      ran: connectors.map((connector) => ({
        source: connector.key,
        status: "skipped" as const,
        rowsWritten: 0,
        detail: "sin DATABASE_URL",
      })),
      hadErrors: false,
    };
  }

  const { trends } = await getCatalog();
  const ran: SourceOutcome[] = [];

  for (const connector of connectors) {
    const runId = await startRun(db, connector.key);
    try {
      const result = await connector.collect({ db, trends, date });

      if (result.status !== "ok") {
        await finishRun(db, runId, result.status, 0, result.reason);
        ran.push({
          source: connector.key,
          status: result.status,
          rowsWritten: 0,
          detail: result.reason,
        });
        continue;
      }

      const written = await writeReadings(db, result.readings);
      await finishRun(db, runId, "ok", written);
      ran.push({ source: connector.key, status: "ok", rowsWritten: written });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await finishRun(db, runId, "error", 0, detail);
      ran.push({
        source: connector.key,
        status: "error",
        rowsWritten: 0,
        detail,
      });
    }
  }

  return { date, ran, hadErrors: ran.some((row) => row.status === "error") };
}
