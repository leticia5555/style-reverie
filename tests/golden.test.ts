import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTrendSummaries } from "@/lib/trends";
import { LIFECYCLES, type Lifecycle } from "@/lib/types";

/**
 * Test de oro: congela el score, el ciclo de vida, el momentum, la variación
 * anual y el número de fuentes de las 25 tendencias del catálogo.
 *
 * Existe para que la migración del seed a Postgres tenga que reproducir los
 * mismos números exactos. Si este test falla después de tocar el origen de los
 * datos, la migración perdió precisión en algún sitio.
 *
 * Si falla después de cambiar los PESOS o los UMBRALES a propósito, entonces
 * hay que regenerarlo: npm run golden
 */
type GoldenRow = {
  id: string;
  score: number;
  lifecycle: Lifecycle;
  momentum7d: number;
  yoyPct: number;
  sourceCount: number;
};

const golden = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "tests/fixtures/golden-scores.json"),
    "utf8",
  ),
) as GoldenRow[];

test("el catálogo sigue teniendo las mismas tendencias", () => {
  const actual = getTrendSummaries().map((row) => row.id).sort();
  assert.deepEqual(actual, golden.map((row) => row.id).sort());
});

test("los 25 scores derivados no han cambiado", () => {
  const actual = new Map(getTrendSummaries().map((row) => [row.id, row]));

  for (const expected of golden) {
    const row = actual.get(expected.id);
    assert.ok(row, `falta la tendencia ${expected.id}`);
    assert.equal(row.score, expected.score, `score de ${expected.id}`);
    assert.equal(
      row.lifecycle,
      expected.lifecycle,
      `ciclo de vida de ${expected.id}`,
    );
    assert.equal(
      row.momentum7d,
      expected.momentum7d,
      `momentum de ${expected.id}`,
    );
    assert.equal(row.yoyPct, expected.yoyPct, `variación anual de ${expected.id}`);
    assert.equal(
      row.sourceCount,
      expected.sourceCount,
      `fuentes de ${expected.id}`,
    );
  }
});

test("el orden por score se mantiene", () => {
  const actual = getTrendSummaries().map((row) => row.id);
  const esperado = [...golden]
    .sort((a, b) => b.score - a.score)
    .map((row) => row.id);
  assert.deepEqual(actual, esperado);
});

test("la distribución de ciclos de vida es la congelada", () => {
  const cuenta = (rows: { lifecycle: Lifecycle }[]) =>
    Object.fromEntries(
      LIFECYCLES.map((key) => [
        key,
        rows.filter((row) => row.lifecycle === key).length,
      ]),
    );
  assert.deepEqual(cuenta(getTrendSummaries()), cuenta(golden));
});
