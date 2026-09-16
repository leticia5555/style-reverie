import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableSourceCount,
  activeSourceCount,
  computeScore,
  NON_PARTICIPATING,
  PARTICIPATING_SOURCES,
  presentSources,
  SOURCE_WEIGHTS,
  sourceBreakdown,
} from "@/lib/scoring";
import { getTrendById } from "@/lib/trends";
import { SOURCES, type Signals } from "@/lib/types";

/* ── los pesos ─────────────────────────────────────────────────────── */

test("los siete pesos conceptuales suman 1", () => {
  const total = SOURCES.reduce((acc, s) => acc + SOURCE_WEIGHTS[s], 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `suman ${total}`);
});

test("los pesos son los acordados", () => {
  assert.deepEqual(SOURCE_WEIGHTS, {
    google_trends: 0.2,
    mercadolibre: 0.2,
    pinterest: 0.18,
    tiktok: 0.15,
    instagram: 0.1,
    editorial: 0.1,
    amazon: 0.07,
  });
});

test("Mercado Libre pesa como Google, y Amazon es el que menos", () => {
  assert.equal(SOURCE_WEIGHTS.mercadolibre, SOURCE_WEIGHTS.google_trends);
  const menor = SOURCES.reduce((a, b) =>
    SOURCE_WEIGHTS[a] <= SOURCE_WEIGHTS[b] ? a : b,
  );
  assert.equal(menor, "amazon");
});

test("Pinterest tiene peso pero no participa", () => {
  assert.equal(SOURCE_WEIGHTS.pinterest, 0.18);
  assert.deepEqual([...NON_PARTICIPATING], ["pinterest"]);
  assert.ok(!PARTICIPATING_SOURCES.includes("pinterest"));
  assert.equal(PARTICIPATING_SOURCES.length, 6);
});

/* ── renormalización ───────────────────────────────────────────────── */

test("DÍA CON 6 FUENTES: todas al mismo valor devuelven ese valor", () => {
  const signals: Signals = Object.fromEntries(
    PARTICIPATING_SOURCES.map((source) => [source, 60]),
  );
  assert.equal(availableSourceCount(signals), 6);
  assert.equal(computeScore(signals), 60);
});

test("DÍA CON 6 FUENTES: el promedio usa los pesos completos", () => {
  // Con las seis presentes los pesos suman 0.82 (falta el .18 de Pinterest),
  // así que se reescalan por 1/0.82.
  const signals: Signals = {
    google_trends: 100,
    mercadolibre: 0,
    tiktok: 0,
    instagram: 0,
    editorial: 0,
    amazon: 0,
  };
  const esperado = Math.round((0.2 / 0.82) * 100 * 10) / 10;
  assert.equal(computeScore(signals), esperado);
});

test("DÍA CON 3 FUENTES: solo cuentan las presentes, reescaladas", () => {
  const signals: Signals = { google_trends: 90, tiktok: 60, amazon: 30 };
  assert.equal(availableSourceCount(signals), 3);

  const pesos = 0.2 + 0.15 + 0.07;
  const esperado =
    Math.round(((90 * 0.2 + 60 * 0.15 + 30 * 0.07) / pesos) * 10) / 10;
  assert.equal(computeScore(signals), esperado);
});

test("DÍA CON 3 FUENTES: todas al mismo valor siguen devolviendo ese valor", () => {
  assert.equal(
    computeScore({ google_trends: 42, editorial: 42, amazon: 42 }),
    42,
  );
});

test("DÍA CON 1 FUENTE: el score es esa fuente, sin diluir", () => {
  assert.equal(computeScore({ mercadolibre: 73.4 }), 73.4);
  assert.equal(computeScore({ amazon: 12 }), 12);
  assert.equal(availableSourceCount({ amazon: 12 }), 1);
});

test("una fuente que falta NO es una fuente en cero", () => {
  const soloUna = computeScore({ google_trends: 80 });
  const conCeros = computeScore({
    google_trends: 80,
    mercadolibre: 0,
    tiktok: 0,
    instagram: 0,
    editorial: 0,
    amazon: 0,
  });
  assert.equal(soloUna, 80);
  assert.ok(
    conCeros! < 25,
    `con ceros explícitos el score se hunde: ${conCeros}`,
  );
});

test("Pinterest presente en las señales no mueve el score", () => {
  const sin = computeScore({ google_trends: 50, tiktok: 50 });
  const con = computeScore({ google_trends: 50, tiktok: 50, pinterest: 100 });
  assert.equal(con, sin);
});

test("un día sin ninguna fuente utilizable devuelve null, no cero", () => {
  assert.equal(computeScore({}), null);
  assert.equal(computeScore({ pinterest: 90 }), null);
});

test("presentSources ignora Pinterest y las fuentes ausentes", () => {
  assert.deepEqual(presentSources({ google_trends: 1, pinterest: 2 }), [
    "google_trends",
  ]);
});

test("el score sigue recortado a 0–100", () => {
  assert.equal(computeScore({ google_trends: 250, amazon: 250 }), 100);
  assert.equal(computeScore({ google_trends: -50 }), 0);
});

/* ── el desglose explica el número que está al lado ────────────────── */

test("los pesos del desglose suman 100% y los aportes suman el score", () => {
  const trend = getTrendById("falda-cargo")!;
  const rows = sourceBreakdown(trend);

  const pesos = rows.reduce((acc, row) => acc + row.weight, 0);
  assert.ok(Math.abs(pesos - 1) < 1e-9, `los pesos suman ${pesos}`);

  const aportes = rows.reduce((acc, row) => acc + row.contribution, 0);
  const score = computeScore(trend.history.at(-1)!.signals)!;
  assert.ok(
    Math.abs(aportes - score) < 0.2,
    `los aportes suman ${aportes} y el score es ${score}`,
  );
});

test("el desglose solo lista fuentes con valor, sin Pinterest", () => {
  const rows = sourceBreakdown(getTrendById("falda-cargo")!);
  assert.ok(!rows.some((row) => row.source === "pinterest"));
  assert.ok(!rows.some((row) => row.source === "mercadolibre"));
  assert.equal(rows.length, 5);
});

test("activeSourceCount nunca supera al total disponible", () => {
  const signals: Signals = { google_trends: 90, tiktok: 10, amazon: 80 };
  assert.equal(activeSourceCount(signals), 2);
  assert.equal(availableSourceCount(signals), 3);
});
