import { getDb } from "@/lib/db/client";
import { finishRun, startRun, writeReadings } from "@/lib/db/runs";
import { ensureDatabase } from "@/lib/db/setup";
import { freezeSundayEdicion } from "@/lib/edicion-archive";
import type { Connector } from "@/lib/sources/types";
import { getCatalog, getTrends, resetCatalogCache } from "@/lib/trends";

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
  /** Qué hizo la puesta a punto del esquema antes de correr las fuentes. */
  setup?: { schemaApplied: boolean; seeded: boolean; error?: string };
  /** Qué pasó con la edición semanal al final de la corrida. */
  edicion?: { published: boolean; date: string | null; reason?: string };
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

  /**
   * El esquema se aplica en cada corrida. Es idempotente y cuesta unos
   * milisegundos, y a cambio un cambio de esquema futuro entra solo con el
   * siguiente cron en vez de requerir una terminal.
   */
  let setup: CronOutcome["setup"];
  try {
    const report = await ensureDatabase(db, getTrends());
    setup = { schemaApplied: report.schemaApplied, seeded: report.seeded };
    if (report.seeded) resetCatalogCache();
  } catch (error) {
    setup = {
      schemaApplied: false,
      seeded: false,
      error: error instanceof Error ? error.message : String(error),
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

  /**
   * La edición se congela DESPUÉS de las fuentes: así el domingo queda
   * guardado con los datos que acaban de entrar y no con los de ayer.
   */
  let edicion: CronOutcome["edicion"];
  try {
    edicion = await freezeSundayEdicion(db, trends);
  } catch (error) {
    edicion = {
      published: false,
      date: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    date,
    ran,
    hadErrors: ran.some((row) => row.status === "error"),
    setup,
    edicion,
  };
}
