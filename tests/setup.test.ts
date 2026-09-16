import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { authorizeOps } from "@/lib/auth";
import { setDb, type Db } from "@/lib/db/client";
import { ensureDatabase } from "@/lib/db/setup";
import { getTrends, resetCatalogCache } from "@/lib/trends";
import { runDaily } from "@/lib/cron";
import type { Connector } from "@/lib/sources/types";

const SECRET = "secreto-de-prueba-largo-para-timing-safe";

let pg: PGlite;
let db: Db;

async function freshDb() {
  await pg?.close();
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  resetCatalogCache();
}

before(async () => {
  process.env.CRON_SECRET = SECRET;
  await freshDb();
});

after(async () => {
  setDb(null);
  resetCatalogCache();
  delete process.env.CRON_SECRET;
  await pg.close();
});

/* ── autorización ──────────────────────────────────────────────────── */

const req = (url: string, headers?: Record<string, string>) =>
  new Request(url, { headers });

test("sin secreto configurado devuelve 503, no 401", () => {
  delete process.env.CRON_SECRET;
  const outcome = authorizeOps(req("https://x.test/api/admin/setup"));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 503);
  process.env.CRON_SECRET = SECRET;
});

test("sin credenciales no autoriza", () => {
  assert.equal(authorizeOps(req("https://x.test/api/admin/setup")).ok, false);
});

test("autoriza por cabecera Bearer, como manda Vercel", () => {
  assert.equal(
    authorizeOps(
      req("https://x.test/api/admin/setup", {
        authorization: `Bearer ${SECRET}`,
      }),
    ).ok,
    true,
  );
});

test("autoriza por ?secret= para poder abrirlo desde el navegador", () => {
  assert.equal(
    authorizeOps(req(`https://x.test/api/admin/setup?secret=${SECRET}`)).ok,
    true,
  );
});

test("un secreto equivocado no entra, ni por cabecera ni por URL", () => {
  assert.equal(
    authorizeOps(
      req("https://x.test/api/admin/setup", { authorization: "Bearer nope" }),
    ).ok,
    false,
  );
  assert.equal(
    authorizeOps(req("https://x.test/api/admin/setup?secret=nope")).ok,
    false,
  );
});

test("un prefijo del secreto correcto tampoco entra", () => {
  assert.equal(
    authorizeOps(
      req(`https://x.test/api/admin/setup?secret=${SECRET.slice(0, -1)}`),
    ).ok,
    false,
  );
});

/* ── puesta a punto ────────────────────────────────────────────────── */

test("sobre una base vacía aplica el esquema y siembra", async () => {
  await freshDb();
  const report = await ensureDatabase(db, getTrends());

  assert.equal(report.schemaApplied, true);
  assert.equal(report.seeded, true);
  assert.equal(report.trends, 25);
  assert.equal(report.signals, 25 * 90 * 6);
});

test("la segunda vez no vuelve a sembrar y dice por qué", async () => {
  const report = await ensureDatabase(db, getTrends());
  assert.equal(report.schemaApplied, true);
  assert.equal(report.seeded, false);
  assert.match(report.skippedSeed!, /ya tiene 25 filas/);
  assert.equal(report.trends, 25);
});

test("EL SEGURO: no pisa una base que ya tiene datos reales", async () => {
  await freshDb();
  await ensureDatabase(db, getTrends());

  // Simula una semana de cron: valores reales encima del catálogo.
  await db.query(
    `update signals set value = 77, origin = 'real'
      where trend_id = 'falda-cargo' and date = '2026-09-14'`,
  );

  const report = await ensureDatabase(db, getTrends());
  assert.equal(report.seeded, false, "no debe volver a sembrar");

  const rows = await db.query<{ value: string; origin: string }>(
    `select value, origin from signals
      where trend_id = 'falda-cargo' and date = '2026-09-14' limit 1`,
  );
  assert.equal(Number(rows[0].value), 77, "el valor real sigue ahí");
  assert.equal(rows[0].origin, "real", "el origen real sigue ahí");
});

test("es idempotente corriéndolo tres veces seguidas", async () => {
  await freshDb();
  for (let i = 0; i < 3; i += 1) await ensureDatabase(db, getTrends());

  const rows = await db.query<{ count: number }>(
    "select count(*)::int as count from signals",
  );
  assert.equal(Number(rows[0].count), 25 * 90 * 6);
});

/* ── el cron se pone a punto solo ──────────────────────────────────── */

const fuenteInerte: Connector = {
  key: "inerte",
  async collect() {
    return { status: "skipped", reason: "sin nada que hacer" };
  },
};

test("el cron aplica el esquema sobre una base recién creada", async () => {
  await freshDb();
  const outcome = await runDaily([fuenteInerte], "2026-09-30");

  assert.equal(outcome.setup?.schemaApplied, true);
  assert.equal(outcome.setup?.seeded, true, "una base vacía se siembra sola");

  const tables = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  assert.deepEqual(
    tables.map((row) => row.table_name),
    ["ediciones", "signal_runs", "signals", "trend_candidates", "trends"],
  );
});

test("en corridas siguientes el cron no vuelve a sembrar", async () => {
  const outcome = await runDaily([fuenteInerte], "2026-10-01");
  assert.equal(outcome.setup?.schemaApplied, true);
  assert.equal(outcome.setup?.seeded, false);
});

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

/* ── la ruta de verdad, con la base inyectada ──────────────────────── */

test("LA RUTA: sobre una base vacía responde ok y siembra", async () => {
  await freshDb();
  const { GET } = await import("@/app/api/admin/setup/route");

  const response = await GET(
    new Request(`https://x.test/api/admin/setup?secret=${SECRET}`),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    status: string;
    seeded: boolean;
    trends: number;
    signals: number;
    durationMs: number;
  };
  assert.equal(body.status, "ok");
  assert.equal(body.seeded, true);
  assert.equal(body.trends, 25);
  assert.equal(body.signals, 25 * 90 * 6);
  assert.ok(body.durationMs >= 0);
});

test("LA RUTA: abrirla otra vez es inofensivo", async () => {
  const { GET } = await import("@/app/api/admin/setup/route");
  const response = await GET(
    new Request(`https://x.test/api/admin/setup?secret=${SECRET}`),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as { seeded: boolean; trends: number };
  assert.equal(body.seeded, false);
  assert.equal(body.trends, 25);
});

test("LA RUTA: sin autorización no llega a tocar la base", async () => {
  const { GET } = await import("@/app/api/admin/setup/route");
  const response = await GET(new Request("https://x.test/api/admin/setup"));
  assert.equal(response.status, 401);
});

test("LA RUTA: no se cachea", async () => {
  const { GET } = await import("@/app/api/admin/setup/route");
  const response = await GET(
    new Request(`https://x.test/api/admin/setup?secret=${SECRET}`),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
