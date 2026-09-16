import type { Db } from "@/lib/db/client";
import { saveCatalogToDb } from "@/lib/db/catalog";
import { migrate } from "@/lib/db/migrate";
import type { Trend } from "@/lib/types";

export type SetupReport = {
  schemaApplied: boolean;
  seeded: boolean;
  trends: number;
  signals: number;
  /** Por qué no se sembró, cuando no se sembró. */
  skippedSeed?: string;
};

async function countRows(db: Db, table: "trends" | "signals"): Promise<number> {
  const rows = await db.query<{ count: number }>(
    `select count(*)::int as count from ${table}`,
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Deja la base lista. Es idempotente de punta a punta y se puede llamar tantas
 * veces como haga falta:
 *
 *  - El esquema es todo `create ... if not exists`.
 *  - El seed solo se carga si la tabla trends está vacía. Una base con datos
 *    reales encima nunca se pisa con el catálogo de muestra.
 *
 * Lo llaman el endpoint de setup y el propio cron, para que un cambio de
 * esquema futuro no requiera una terminal.
 */
export async function ensureDatabase(
  db: Db,
  trends: Trend[],
): Promise<SetupReport> {
  await migrate(db);

  const existing = await countRows(db, "trends");
  if (existing > 0) {
    return {
      schemaApplied: true,
      seeded: false,
      trends: existing,
      signals: await countRows(db, "signals"),
      skippedSeed: `la tabla trends ya tiene ${existing} filas`,
    };
  }

  await saveCatalogToDb(db, trends, "mock");

  return {
    schemaApplied: true,
    seeded: true,
    trends: await countRows(db, "trends"),
    signals: await countRows(db, "signals"),
  };
}
