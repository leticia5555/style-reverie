import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { loadCatalogFromDb, saveCatalogToDb } from "@/lib/db/catalog";
import { getTrends, getTrendSummaries } from "@/lib/trends";
import type { Lifecycle } from "@/lib/types";

/**
 * Postgres de verdad (PGlite, wasm) para correr el esquema y las consultas sin
 * depender de la red. Lo que se verifica aquí es el contrato de la migración:
 * el catálogo que vuelve de la base tiene que producir los mismos scores que
 * el seed, dígito a dígito.
 */
let pg: PGlite;
let db: Db;

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pg.query(sql, params);
      return result.rows as T[];
    },
  };
  await migrate(db);
});

after(async () => {
  setDb(null);
  await pg.close();
});

test("el esquema se aplica y es idempotente", async () => {
  await migrate(db);
  const tables = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  assert.deepEqual(
    tables.map((row) => row.table_name),
    [
      "ediciones",
      "image_hosts",
      "signal_runs",
      "signals",
      "trend_candidates",
      "trend_images",
      "trends",
    ],
  );
});

test("la migración escribe las 25 tendencias y sus 90 días por fuente", async () => {
  const written = await saveCatalogToDb(db, getTrends(), "mock");
  assert.equal(written, 25 * 90 * 6);

  const [{ count: trends }] = await db.query<{ count: string }>(
    "select count(*)::int as count from trends",
  );
  assert.equal(Number(trends), 25);

  const [{ count: signals }] = await db.query<{ count: string }>(
    "select count(*)::int as count from signals",
  );
  assert.equal(Number(signals), 25 * 90 * 6);
});

test("es idempotente: correrla dos veces no duplica filas", async () => {
  await saveCatalogToDb(db, getTrends(), "mock");
  const [{ count }] = await db.query<{ count: string }>(
    "select count(*)::int as count from signals",
  );
  assert.equal(Number(count), 25 * 90 * 6);
});

test("el único sobre (trend_id, source, date) está activo", async () => {
  await assert.rejects(
    () =>
      db.query(
        `insert into signals (trend_id, source, date, value, origin)
         values ('falda-cargo', 'tiktok', '2026-09-14', 50, 'mock')`,
      ),
    /duplicate key|unique/i,
  );
});

test("origin solo admite mock o real", async () => {
  await assert.rejects(
    () =>
      db.query(
        `insert into signals (trend_id, source, date, value, origin)
         values ('falda-cargo', 'tiktok', '2030-01-01', 50, 'inventado')`,
      ),
    /violates check constraint/i,
  );
});

test("EL CONTRATO: los scores desde la base son idénticos a los del seed", async () => {
  const catalog = await loadCatalogFromDb(db);
  assert.ok(catalog, "la base devolvió catálogo");

  const desdeSeed = getTrendSummaries();
  const desdeDb = getTrendSummaries(catalog.trends);

  assert.equal(desdeDb.length, desdeSeed.length);
  for (let i = 0; i < desdeSeed.length; i += 1) {
    const seed = desdeSeed[i];
    const base = desdeDb[i];
    assert.equal(base.id, seed.id, `orden en la posición ${i}`);
    assert.equal(base.score, seed.score, `score de ${seed.id}`);
    assert.equal(base.lifecycle, seed.lifecycle, `ciclo de ${seed.id}`);
    assert.equal(base.momentum7d, seed.momentum7d, `momentum de ${seed.id}`);
    assert.equal(base.yoyPct, seed.yoyPct, `variación anual de ${seed.id}`);
    assert.equal(base.sourceCount, seed.sourceCount, `fuentes de ${seed.id}`);
  }
});

test("el test de oro también pasa con el catálogo de la base", async () => {
  const catalog = await loadCatalogFromDb(db);
  const golden = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "tests/fixtures/golden-scores.json"),
      "utf8",
    ),
  ) as { id: string; score: number; lifecycle: Lifecycle }[];

  const rows = new Map(
    getTrendSummaries(catalog!.trends).map((row) => [row.id, row]),
  );
  for (const expected of golden) {
    const row = rows.get(expected.id);
    assert.equal(row?.score, expected.score, `score de ${expected.id}`);
    assert.equal(row?.lifecycle, expected.lifecycle, `ciclo de ${expected.id}`);
  }
});

test("el origen de cada día vuelve marcado como mock", async () => {
  const catalog = await loadCatalogFromDb(db);
  const origins = catalog!.origins.get("falda-cargo");
  assert.ok(origins);
  assert.equal(origins.size, 90);
  assert.ok([...origins.values()].every((value) => value === "mock"));
});

test("un día con una fuente real se marca mock hasta que todas lo son", async () => {
  await db.query(
    `update signals set origin = 'real'
      where trend_id = 'falda-cargo' and date = '2026-09-14' and source = 'tiktok'`,
  );
  let catalog = await loadCatalogFromDb(db);
  assert.equal(
    catalog!.origins.get("falda-cargo")!.get("2026-09-14"),
    "mock",
    "con una sola fuente real el día sigue siendo mock",
  );

  await db.query(
    `update signals set origin = 'real'
      where trend_id = 'falda-cargo' and date = '2026-09-14'`,
  );
  catalog = await loadCatalogFromDb(db);
  assert.equal(
    catalog!.origins.get("falda-cargo")!.get("2026-09-14"),
    "real",
    "con las seis fuentes reales el día es real",
  );

  await db.query(
    `update signals set origin = 'mock'
      where trend_id = 'falda-cargo' and date = '2026-09-14'`,
  );
});

test("una edición publicada se congela y no se vuelve a derivar", async () => {
  const { getEdicion, currentEdicionDate } = await import("@/lib/edicion");
  const { publishEdicion, getPublishedEdicion, listPublishedDates } =
    await import("@/lib/db/ediciones");

  const date = currentEdicionDate();
  const edicion = getEdicion(date)!;
  await publishEdicion(db, edicion);

  const stored = await getPublishedEdicion(db, date);
  assert.ok(stored);
  assert.equal(stored.date, date);
  assert.deepEqual(
    stored.picks.map((pick) => pick.summary.id),
    edicion.picks.map((pick) => pick.summary.id),
  );

  // Publicar otra vez no la pisa: lo congelado se queda como estaba.
  await publishEdicion(db, { ...edicion, intro: { es: "otra", en: "other" } });
  const again = await getPublishedEdicion(db, date);
  assert.equal(again!.intro.es, edicion.intro.es);

  assert.deepEqual(await listPublishedDates(db), [date]);
});
