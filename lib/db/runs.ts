import type { Db } from "@/lib/db/client";
import type { Reading } from "@/lib/sources/types";

/**
 * Auditoría de cada corrida. Sin esto no hay forma de saber por qué falta un
 * día en una serie, que es justo la pregunta que uno se hace tres semanas
 * después.
 */
export async function startRun(db: Db, source: string): Promise<number> {
  const rows = await db.query<{ id: number }>(
    `insert into signal_runs (source, status) values ($1, 'ok') returning id`,
    [source],
  );
  return rows[0].id;
}

export async function finishRun(
  db: Db,
  id: number,
  status: "ok" | "error" | "skipped",
  rowsWritten: number,
  detail?: string,
): Promise<void> {
  await db.query(
    `update signal_runs
        set finished_at = now(), status = $2, rows_written = $3, detail = $4
      where id = $1`,
    [id, status, rowsWritten, detail ?? null],
  );
}

/**
 * Escribe lecturas con origin 'real'. Idempotente por (trend_id, source,
 * date): si el cron se reintenta, el día se sobrescribe en vez de duplicarse.
 */
export async function writeReadings(
  db: Db,
  readings: Reading[],
): Promise<number> {
  let written = 0;
  for (const reading of readings) {
    await db.query(
      `insert into signals (trend_id, source, date, value, origin)
       values ($1, $2, $3, $4, 'real')
       on conflict (trend_id, source, date) do update set
         value = excluded.value, origin = 'real'`,
      [reading.trendId, reading.source, reading.date, reading.value],
    );
    written += 1;
  }
  return written;
}

export type RunRow = {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: "ok" | "error" | "skipped";
  rows_written: number;
  detail: string | null;
};

export async function recentRuns(db: Db, limit = 20): Promise<RunRow[]> {
  return db.query<RunRow>(
    "select * from signal_runs order by started_at desc limit $1",
    [limit],
  );
}
