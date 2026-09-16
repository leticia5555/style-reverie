import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { recentRuns } from "@/lib/db/runs";
import { GET } from "@/app/api/admin/discover/route";

const SECRET = "secreto-de-prueba-largo-para-timing-safe";
const URL_BASE = "https://x.test/api/admin/discover";

let pg: PGlite;
let db: Db;
let apiKey: string | undefined;

const req = (url: string, headers?: Record<string, string>) =>
  new Request(url, { headers });

before(async () => {
  process.env.CRON_SECRET = SECRET;
  // Sin clave el paso se salta: la ruta se puede probar entera sin llamar a
  // la API de Anthropic ni gastar un token.
  apiKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  await migrate(db);
});

after(async () => {
  setDb(null);
  delete process.env.CRON_SECRET;
  if (apiKey) process.env.ANTHROPIC_API_KEY = apiKey;
  await pg.close();
});

test("sin credenciales devuelve 401", async () => {
  const response = await GET(req(URL_BASE));
  assert.equal(response.status, 401);
});

test("con un secreto equivocado tampoco entra", async () => {
  const response = await GET(req(`${URL_BASE}?secret=otro`));
  assert.equal(response.status, 401);
});

test("autoriza por cabecera Bearer y por ?secret=", async () => {
  const porCabecera = await GET(
    req(URL_BASE, { authorization: `Bearer ${SECRET}` }),
  );
  const porQuery = await GET(req(`${URL_BASE}?secret=${SECRET}`));
  assert.equal(porCabecera.status, 200);
  assert.equal(porQuery.status, 200);
});

test("devuelve el desglose, que es para lo que existe la ruta", async () => {
  const body = await (await GET(req(`${URL_BASE}?secret=${SECRET}`))).json();

  assert.equal(body.status, "skipped", "sin ANTHROPIC_API_KEY se salta");
  assert.match(body.reason, /ANTHROPIC_API_KEY/);
  assert.match(body.breakdown, /titulares/);
  assert.match(body.breakdown, /pasaron el filtro/);
  assert.equal(typeof body.stats.received, "number");
  assert.equal(typeof body.stats.batches, "number");
  assert.equal(typeof body.durationMs, "number");
});

test("la corrida a mano se distingue de la del cron en la bitácora", async () => {
  await GET(req(`${URL_BASE}?secret=${SECRET}`));
  const runs = await recentRuns(db);
  const run = runs.find((row) => row.source === "discover-manual");

  assert.ok(run, "queda registrada");
  assert.equal(run.status, "skipped");
  assert.match(run.detail ?? "", /pasaron el filtro/);
  assert.ok(
    !runs.some((row) => row.source === "discovery"),
    "no se hace pasar por la corrida del cron",
  );
});

test("acepta una fecha, para poder repetir un día concreto", async () => {
  const response = await GET(req(`${URL_BASE}?secret=${SECRET}&date=2026-09-01`));
  assert.equal(response.status, 200);
});

test("sin CRON_SECRET configurado devuelve 503, no 401", async () => {
  delete process.env.CRON_SECRET;
  try {
    assert.equal((await GET(req(URL_BASE))).status, 503);
  } finally {
    process.env.CRON_SECRET = SECRET;
  }
});
