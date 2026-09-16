/**
 * Aplica el esquema a la base de DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * Es idempotente: todo el esquema es `create ... if not exists`.
 */
import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("Falta DATABASE_URL.");
    process.exitCode = 1;
    return;
  }
  await migrate(db);
  const tables = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  console.log("tablas:", tables.map((row) => row.table_name).join(", "));
}

main();
