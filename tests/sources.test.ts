import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { saveCatalogToDb } from "@/lib/db/catalog";
import { normalizeToScale } from "@/lib/sources/types";
import {
  mapTrendsToCatalog,
  mercadoLibreConnector,
} from "@/lib/sources/mercadolibre";
import {
  averageInterest,
  backoffDelay,
  googleTrendsConnector,
  pendingTrends,
} from "@/lib/sources/google-trends";
import { getTrends } from "@/lib/trends";

const trends = getTrends();

/* ── normalización ─────────────────────────────────────────────────── */

test("normalizeToScale lleva el mayor a 100 y respeta proporciones", () => {
  const scaled = normalizeToScale(new Map([["a", 50], ["b", 25], ["c", 0]]));
  assert.equal(scaled.get("a"), 100);
  assert.equal(scaled.get("b"), 50);
  assert.equal(scaled.get("c"), 0);
});

test("normalizeToScale no divide por cero", () => {
  const scaled = normalizeToScale(new Map([["a", 0], ["b", 0]]));
  assert.deepEqual([...scaled.values()], [0, 0]);
});

/* ── Mercado Libre ─────────────────────────────────────────────────── */

test("mapea términos del ranking a tendencias por sus keywords", () => {
  const readings = mapTrendsToCatalog(
    [
      { keyword: "pantalon barril" },
      { keyword: "botas de invierno" },
      { keyword: "falda cargo" },
    ],
    trends,
    "2026-09-20",
  );
  const ids = readings.map((row) => row.trendId).sort();
  assert.ok(ids.includes("pantalon-barril"));
  assert.ok(ids.includes("falda-cargo"));
});

test("pesa por posición: lo que sale primero vale más", () => {
  const primero = mapTrendsToCatalog(
    [{ keyword: "falda cargo" }, { keyword: "pantalon barril" }],
    trends,
    "2026-09-20",
  );
  const falda = primero.find((row) => row.trendId === "falda-cargo")!;
  const barril = primero.find((row) => row.trendId === "pantalon-barril")!;
  assert.ok(falda.value > barril.value, `${falda.value} > ${barril.value}`);
});

test("todas las lecturas quedan dentro de 0–100", () => {
  const readings = mapTrendsToCatalog(
    trends.slice(0, 10).map((trend) => ({ keyword: trend.keywords[0] })),
    trends,
    "2026-09-20",
  );
  assert.ok(readings.length);
  assert.ok(readings.every((row) => row.value >= 0 && row.value <= 100));
  assert.equal(Math.max(...readings.map((row) => row.value)), 100);
});

test("un ranking sin coincidencias no inventa lecturas", () => {
  assert.deepEqual(
    mapTrendsToCatalog(
      [{ keyword: "refrigerador" }, { keyword: "taladro" }],
      trends,
      "2026-09-20",
    ),
    [],
  );
});

test("un ranking vacío devuelve vacío", () => {
  assert.deepEqual(mapTrendsToCatalog([], trends, "2026-09-20"), []);
});

test("sin credenciales el conector se salta y dice por qué", async () => {
  delete process.env.ML_CLIENT_ID;
  delete process.env.ML_CLIENT_SECRET;
  const result = await mercadoLibreConnector.collect({
    db: null as unknown as Db,
    trends,
    date: "2026-09-20",
  });
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /ML_CLIENT_ID/);
});

/* ── Google Trends ─────────────────────────────────────────────────── */

test("averageInterest promedia la serie que devuelve Google", () => {
  const payload = JSON.stringify({
    default: {
      timelineData: [{ value: [10] }, { value: [20] }, { value: [30] }],
    },
  });
  assert.equal(averageInterest(payload), 20);
});

test("averageInterest devuelve null ante basura o serie vacía", () => {
  assert.equal(averageInterest("no es json"), null);
  assert.equal(
    averageInterest(JSON.stringify({ default: { timelineData: [] } })),
    null,
  );
});

test("el backoff crece exponencialmente y lleva jitter", () => {
  const primero = backoffDelay(0, 1000);
  const tercero = backoffDelay(2, 1000);
  assert.ok(primero >= 750 && primero <= 1250, `${primero}`);
  assert.ok(tercero >= 3000 && tercero <= 5000, `${tercero}`);
  assert.ok(tercero > primero);
});

let pg: PGlite;
let db: Db;

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  await migrate(db);
  await saveCatalogToDb(db, trends, "mock");
});

after(async () => {
  setDb(null);
  await pg.close();
});

test("la base hace de caché: una tendencia con valor de hoy no se vuelve a consultar", async () => {
  const antes = await pendingTrends(db, trends, "2026-09-25");
  assert.equal(antes.length, trends.length, "al principio faltan todas");

  await db.query(
    `insert into signals (trend_id, source, date, value, origin)
     values ('falda-cargo', 'google_trends', '2026-09-25', 42, 'real')`,
  );

  const despues = await pendingTrends(db, trends, "2026-09-25");
  assert.equal(despues.length, trends.length - 1);
  assert.ok(!despues.some((trend) => trend.id === "falda-cargo"));
});

test("si ya están todas, el conector se salta sin llamar a Google", async () => {
  for (const trend of trends) {
    await db.query(
      `insert into signals (trend_id, source, date, value, origin)
       values ($1, 'google_trends', '2026-09-26', 50, 'real')
       on conflict do nothing`,
      [trend.id],
    );
  }
  const result = await googleTrendsConnector.collect({
    db,
    trends,
    date: "2026-09-26",
  });
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /ya tienen valor de hoy/);
});
