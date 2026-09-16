/**
 * Carga el seed en Postgres con origin 'mock'.
 *
 *   npm run db:seed
 *
 * Idempotente por (trend_id, source, date): correrlo dos veces deja la base
 * igual. No toca las señales con origin 'real' de otras fechas.
 */
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { saveCatalogToDb } from "@/lib/db/catalog";
import { getTrends } from "@/lib/trends";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("Falta DATABASE_URL.");
    process.exitCode = 1;
    return;
  }

  await migrate(db);
  const trends = getTrends();
  const written = await saveCatalogToDb(db, trends, "mock");

  const [{ count }] = await db.query<{ count: number }>(
    "select count(*)::int as count from signals where origin = 'mock'",
  );
  console.log(
    `${trends.length} tendencias · ${written} señales escritas · ${count} señales mock en la base`,
  );
}

main();
