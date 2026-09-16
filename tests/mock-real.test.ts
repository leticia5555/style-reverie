import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { loadCatalogFromDb, saveCatalogToDb } from "@/lib/db/catalog";
import { writeReadings } from "@/lib/db/runs";
import { computeScore, presentSources } from "@/lib/scoring";
import { splitByOrigin, summarizeOrigin } from "@/lib/origin";
import { getTrends, getTrendDetail, resetCatalogCache } from "@/lib/trends";
import { scoreSeries } from "@/lib/scoring";

const TREND = "falda-cargo";
const HOY = "2026-09-14";

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
  setDb(db);
  resetCatalogCache();
  await saveCatalogToDb(db, getTrends(), "mock");
});

after(async () => {
  setDb(null);
  resetCatalogCache();
  await pg.close();
});

async function señal(source: string, date = HOY) {
  const rows = await db.query<{ value: string; origin: string }>(
    `select value, origin from signals
      where trend_id = $1 and source = $2 and date = $3`,
    [TREND, source, date],
  );
  return rows[0];
}

test("de partida el día es todo mock, con las seis fuentes del seed", async () => {
  const antes = await señal("google_trends");
  assert.equal(antes.origin, "mock");

  const catalog = await loadCatalogFromDb(db);
  const dia = catalog!.trends
    .find((trend) => trend.id === TREND)!
    .history.find((point) => point.date === HOY)!;
  assert.equal(Object.keys(dia.signals).length, 6);
});

test("EL REEMPLAZO: el cron pisa el valor mock del mismo día", async () => {
  const antes = await señal("google_trends");

  await writeReadings(db, [
    { trendId: TREND, source: "google_trends", date: HOY, value: 91.5 },
  ]);

  const despues = await señal("google_trends");
  assert.equal(Number(despues.value), 91.5);
  assert.equal(despues.origin, "real", "el origen cambia con el valor");
  assert.notEqual(Number(antes.value), 91.5, "de verdad era otro valor antes");
});

test("no deja hueco: el día sigue teniendo las mismas fuentes", async () => {
  const catalog = await loadCatalogFromDb(db);
  const dia = catalog!.trends
    .find((trend) => trend.id === TREND)!
    .history.find((point) => point.date === HOY)!;

  assert.equal(Object.keys(dia.signals).length, 6);
  assert.equal(dia.signals.google_trends, 91.5);
});

test("mercadolibre entra como fuente nueva sin romper el día", async () => {
  await writeReadings(db, [
    { trendId: TREND, source: "mercadolibre", date: HOY, value: 80 },
  ]);

  const catalog = await loadCatalogFromDb(db);
  const dia = catalog!.trends
    .find((trend) => trend.id === TREND)!
    .history.find((point) => point.date === HOY)!;

  assert.equal(Object.keys(dia.signals).length, 7);
  assert.equal(dia.signals.mercadolibre, 80);
  // Siete guardadas, seis participan: Pinterest nunca cuenta.
  assert.equal(presentSources(dia.signals).length, 6);
});

test("EL SCORE: el día mixto se renormaliza sobre las seis que participan", async () => {
  const catalog = await loadCatalogFromDb(db);
  const dia = catalog!.trends
    .find((trend) => trend.id === TREND)!
    .history.find((point) => point.date === HOY)!;

  const pesos = { google_trends: 0.2, mercadolibre: 0.2, tiktok: 0.15, instagram: 0.1, editorial: 0.1, amazon: 0.07 } as const;
  const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
  const esperado =
    Math.round(
      (Object.entries(pesos).reduce(
        (acc, [source, peso]) =>
          acc + dia.signals[source as keyof typeof pesos]! * peso,
        0,
      ) /
        suma) *
        10,
    ) / 10;

  assert.equal(computeScore(dia.signals), esperado);
});

test("EL CORTE: cae en la primera fecha con todas sus fuentes reales", async () => {
  // Hoy tiene google_trends y mercadolibre reales, pero el resto sigue mock:
  // el día completo todavía no es real.
  let catalog = await loadCatalogFromDb(db);
  assert.equal(
    catalog!.origins.get(TREND)!.get(HOY),
    "mock",
    "con fuentes mixtas el día sigue siendo mock",
  );

  // Se marcan reales todas las fuentes de los últimos tres días.
  const dias = ["2026-09-12", "2026-09-13", HOY];
  await db.query(
    `update signals set origin = 'real'
      where trend_id = $1 and date = any($2::date[])`,
    [TREND, dias],
  );

  catalog = await loadCatalogFromDb(db);
  const origins = catalog!.origins.get(TREND)!;
  const summary = summarizeOrigin(origins);

  assert.equal(summary.state, "mixed");
  assert.equal(summary.firstRealDate, "2026-09-12");
  assert.equal(summary.realDays, 3);

  const trend = catalog!.trends.find((t) => t.id === TREND)!;
  const series = trend.history.map((point, index) => ({
    date: point.date,
    score: scoreSeries(trend.history)[index],
  }));

  const split = splitByOrigin(series, origins)!;
  assert.equal(split.firstRealDate, "2026-09-12", "el corte está en la fecha correcta");

  const indice = split.rows.findIndex((row) => row.date === "2026-09-12");

  // Antes del corte, tramo mock. El día inmediatamente anterior lleva ADEMÁS
  // valor real a propósito: es donde empalman las dos líneas, y sin eso la
  // gráfica se rompe justo donde más importa que se vea continua.
  const antes = split.rows.slice(0, indice - 1);
  assert.ok(
    antes.every((row) => row.mock !== null && row.real === null),
    "el tramo mock no lleva valores reales",
  );

  const empalme = split.rows[indice - 1];
  assert.ok(
    empalme.mock !== null && empalme.real !== null,
    "el día del empalme lleva los dos valores",
  );
  assert.equal(empalme.mock, empalme.real, "y son el mismo número");

  const desde = split.rows.slice(indice);
  assert.ok(
    desde.every((row) => row.real !== null && row.mock === null),
    "desde el corte, solo tramo real",
  );
});

test("la ficha entera se arma con el catálogo mixto", async () => {
  const catalog = await loadCatalogFromDb(db);
  const detail = getTrendDetail(TREND, catalog!.trends)!;

  assert.equal(detail.series.length, 90, "no se perdió ningún día");
  assert.ok(detail.series.every((point) => Number.isFinite(point.score)));
  assert.ok(detail.breakdown.length >= 5);
  assert.ok(!detail.breakdown.some((row) => row.source === "pinterest"));
  assert.ok(detail.breakdown.some((row) => row.source === "mercadolibre"));
});

test("un día al que solo le queda una fuente sigue puntuando", async () => {
  await db.query(
    `delete from signals
      where trend_id = $1 and date = '2026-09-13' and source <> 'amazon'`,
    [TREND],
  );

  const catalog = await loadCatalogFromDb(db);
  const trend = catalog!.trends.find((t) => t.id === TREND)!;
  const dia = trend.history.find((point) => point.date === "2026-09-13");

  assert.ok(dia, "el día no desaparece por quedarse con una sola fuente");
  assert.equal(Object.keys(dia.signals).length, 1);
  assert.equal(computeScore(dia.signals), dia.signals.amazon);
  assert.equal(trend.history.length, 90);
});
