import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { saveCatalogToDb } from "@/lib/db/catalog";
import { recentRuns } from "@/lib/db/runs";
import { runDaily } from "@/lib/cron";
import { getTrends, resetCatalogCache } from "@/lib/trends";
import type { Connector } from "@/lib/sources/types";

let pg: PGlite;
let db: Db;

const fuenteQueEscribe = (key: string, values: number[]): Connector => ({
  key,
  async collect({ trends, date }) {
    return {
      status: "ok",
      readings: trends.slice(0, values.length).map((trend, index) => ({
        trendId: trend.id,
        source: key,
        date,
        value: values[index],
      })),
    };
  },
});

const fuenteQueRevienta: Connector = {
  key: "revienta",
  async collect() {
    throw new Error("la API se cayó");
  },
};

const fuenteSinCredenciales: Connector = {
  key: "sin-credenciales",
  async collect() {
    return { status: "skipped", reason: "faltan credenciales" };
  },
};

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  await migrate(db);
  setDb(db);
  resetCatalogCache();
  await saveCatalogToDb(db, getTrends(), "mock");
});

after(async () => {
  setDb(null);
  resetCatalogCache();
  await pg.close();
});

test("una fuente que revienta no aborta a las demás", async () => {
  const outcome = await runDaily(
    [fuenteQueRevienta, fuenteQueEscribe("buena", [10, 20, 30])],
    "2026-09-20",
  );

  const porFuente = new Map(outcome.ran.map((row) => [row.source, row]));
  assert.equal(porFuente.get("revienta")!.status, "error");
  assert.match(porFuente.get("revienta")!.detail!, /la API se cayó/);
  assert.equal(porFuente.get("buena")!.status, "ok");
  assert.equal(porFuente.get("buena")!.rowsWritten, 3);
  assert.equal(outcome.hadErrors, true);
});

test("una fuente sin credenciales se salta y queda registrado", async () => {
  const outcome = await runDaily([fuenteSinCredenciales], "2026-09-20");
  assert.equal(outcome.ran[0].status, "skipped");
  assert.equal(outcome.hadErrors, false, "saltarse no es un error");

  const runs = await recentRuns(db);
  const run = runs.find((row) => row.source === "sin-credenciales");
  assert.equal(run!.status, "skipped");
  assert.match(run!.detail!, /faltan credenciales/);
});

test("cada corrida queda en signal_runs con su recuento", async () => {
  await runDaily([fuenteQueEscribe("auditada", [55, 66])], "2026-09-21");
  const runs = await recentRuns(db);
  const run = runs.find((row) => row.source === "auditada");
  assert.ok(run);
  assert.equal(run.status, "ok");
  assert.equal(run.rows_written, 2);
  assert.ok(run.finished_at, "la corrida se cierra");
});

test("es idempotente: dos corridas del mismo día no duplican filas", async () => {
  const fuente = fuenteQueEscribe("idempotente", [40, 50]);
  await runDaily([fuente], "2026-09-22");
  await runDaily([fuente], "2026-09-22");

  const rows = await db.query<{ count: string }>(
    `select count(*)::int as count from signals
      where source = 'idempotente' and date = '2026-09-22'`,
  );
  assert.equal(Number(rows[0].count), 2);
});

test("la segunda corrida sobrescribe el valor en vez de dejar el viejo", async () => {
  await runDaily([fuenteQueEscribe("pisa", [10, 10])], "2026-09-23");
  await runDaily([fuenteQueEscribe("pisa", [90, 90])], "2026-09-23");

  const rows = await db.query<{ value: string }>(
    `select value from signals
      where source = 'pisa' and date = '2026-09-23' order by trend_id`,
  );
  assert.deepEqual(rows.map((row) => Number(row.value)), [90, 90]);
});

test("lo que escribe el cron queda con origin real", async () => {
  await runDaily([fuenteQueEscribe("marcada", [70])], "2026-09-24");
  const rows = await db.query<{ origin: string }>(
    "select origin from signals where source = 'marcada'",
  );
  assert.ok(rows.length);
  assert.ok(rows.every((row) => row.origin === "real"));
});

test("el paso de descubrimiento deja su desglose en signal_runs", async () => {
  // Sin ANTHROPIC_API_KEY el paso se salta, pero el detalle tiene que decir
  // igualmente cuántos titulares llegaron y dónde se quedaron: una corrida
  // que termina sin candidatas es justo la que hay que poder explicar.
  const anterior = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    const outcome = await runDaily([fuenteQueEscribe("desglose", [42])], "2026-09-25");

    assert.equal(outcome.discovery?.status, "skipped");
    assert.ok(outcome.discovery?.stats, "la corrida devuelve el desglose");

    const runs = await recentRuns(db);
    const discovery = runs.find((run) => run.source === "discovery");
    assert.ok(discovery, "hay una fila de discovery");
    assert.match(discovery.detail ?? "", /falta ANTHROPIC_API_KEY/);
    assert.match(discovery.detail ?? "", /titulares/);
    assert.match(discovery.detail ?? "", /pasaron el filtro/);
    assert.match(discovery.detail ?? "", /nuevas$/);
  } finally {
    if (anterior) process.env.ANTHROPIC_API_KEY = anterior;
  }
});
