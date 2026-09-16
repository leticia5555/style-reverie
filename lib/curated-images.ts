import type { Db } from "@/lib/db/client";

/**
 * Fotos curadas a mano y hosts aprobados, en la base.
 *
 * El contrato de `content/` dice que lo curado pasa por git, y sigue siendo
 * verdad para `content/trends/`. Pero eso se lee durante el build y en Vercel
 * el disco es de solo lectura: un formulario web no puede escribir ahí. Lo que
 * se cura desde `/admin/imagenes` va a Postgres, que sí se puede escribir en
 * caliente, y por eso aparece antes que `content/` en el orden de prioridad:
 * es la acción humana más reciente y no requiere un deploy para verse.
 */

export type CuratedImageRow = {
  trendId: string;
  imageUrl: string;
  credit: string;
  creditUrl: string;
};

type DbRow = {
  trend_id: string;
  image_url: string;
  credit: string;
  credit_url: string;
};

export async function listCuratedImages(db: Db): Promise<CuratedImageRow[]> {
  const rows = await db.query<DbRow>(
    "select trend_id, image_url, credit, credit_url from trend_images",
  );
  return rows.map((row) => ({
    trendId: row.trend_id,
    imageUrl: row.image_url,
    credit: row.credit,
    creditUrl: row.credit_url,
  }));
}

/** Guarda o reemplaza la foto de una tendencia. Idempotente por trend_id. */
export async function saveCuratedImage(
  db: Db,
  image: CuratedImageRow,
): Promise<void> {
  await db.query(
    `insert into trend_images (trend_id, image_url, credit, credit_url)
     values ($1, $2, $3, $4)
     on conflict (trend_id) do update set
       image_url = excluded.image_url,
       credit = excluded.credit,
       credit_url = excluded.credit_url,
       updated_at = now()`,
    [image.trendId, image.imageUrl, image.credit, image.creditUrl],
  );
}

/** Quita la foto curada: la tendencia vuelve a la del feed o al pastel. */
export async function removeCuratedImage(db: Db, trendId: string): Promise<void> {
  await db.query("delete from trend_images where trend_id = $1", [trendId]);
}

export async function listApprovedHosts(db: Db): Promise<string[]> {
  const rows = await db.query<{ host: string }>(
    "select host from image_hosts order by host",
  );
  return rows.map((row) => row.host);
}

/** Aprueba un host. Idempotente: aprobar dos veces no es un error. */
export async function approveHost(db: Db, host: string): Promise<void> {
  await db.query(
    "insert into image_hosts (host) values ($1) on conflict (host) do nothing",
    [host.toLowerCase()],
  );
}
