import type { Db } from "@/lib/db/client";
import type { Edicion } from "@/lib/edicion";

/**
 * Ediciones publicadas, congeladas en la base.
 *
 * Una edición con fecha es un documento, no una consulta. Si se recalculara,
 * en cuanto entren señales reales una edición de agosto mezclaría 90 días
 * mock con unos pocos reales y cambiaría sola sin avisar. Al publicarla se
 * guarda entera y ya no se vuelve a derivar.
 */
export async function publishEdicion(db: Db, edicion: Edicion): Promise<void> {
  await db.query(
    `insert into ediciones (date, payload)
     values ($1, $2)
     on conflict (date) do nothing`,
    [edicion.date, JSON.stringify(edicion)],
  );
}

export async function getPublishedEdicion(
  db: Db,
  date: string,
): Promise<Edicion | null> {
  const rows = await db.query<{ payload: Edicion }>(
    "select payload from ediciones where date = $1",
    [date],
  );
  return rows[0]?.payload ?? null;
}

export async function listPublishedDates(db: Db): Promise<string[]> {
  const rows = await db.query<{ date: string | Date }>(
    "select date from ediciones order by date desc",
  );
  return rows.map((row) =>
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10),
  );
}
