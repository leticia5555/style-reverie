import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaleta, getSeasonPalette } from "@/lib/paleta";

const entries = getPaleta();
const season = getSeasonPalette(entries)!;

test("devuelve los cinco colores del catálogo", () => {
  assert.equal(season.colors.length, 5);
  assert.ok(season.colors.every((color) => /^#[0-9A-F]{6}$/i.test(color.hex)));
  assert.ok(season.colors.every((color) => color.name.es && color.name.en));
});

test("cada color trae su puesto por score y por momentum", () => {
  const porScore = season.colors.map((color) => color.scoreRank).sort();
  const porMomentum = season.colors.map((color) => color.momentumRank).sort();
  assert.deepEqual(porScore, [1, 2, 3, 4, 5]);
  assert.deepEqual(porMomentum, [1, 2, 3, 4, 5]);
});

test("el orden es el promedio de los dos puestos", () => {
  const combinado = season.colors.map(
    (color) => (color.scoreRank + color.momentumRank) / 2,
  );
  for (let i = 1; i < combinado.length; i += 1) {
    assert.ok(
      combinado[i] >= combinado[i - 1],
      `posición ${i}: ${combinado[i]} debería ser >= ${combinado[i - 1]}`,
    );
  }
});

test("no es solo el orden por score", () => {
  const porSeason = season.colors.map((color) => color.trendId);
  const porScore = [...season.colors]
    .sort((a, b) => b.score - a.score)
    .map((color) => color.trendId);
  assert.notDeepEqual(
    porSeason,
    porScore,
    "si coincidieran, el momentum no estaría pesando",
  );
});

test("un color que cae no puede encabezar la temporada", () => {
  assert.notEqual(season.colors[0].lifecycle, "CAYENDO");
});

test("la línea de contexto sale de los números, en los dos idiomas", () => {
  const lider = season.colors[0];
  assert.ok(season.line.es.includes(lider.name.es));
  assert.ok(season.line.en.includes(lider.name.en));
  assert.ok(season.line.es.includes(lider.score.toFixed(1)));
});

test("la distancia que menciona la línea nunca es negativa", () => {
  const numeros = season.line.es.match(/-?\d+\.\d/g) ?? [];
  assert.ok(numeros.length > 0);
  assert.ok(
    !season.line.es.includes("con -"),
    `la línea no puede decir una distancia negativa: ${season.line.es}`,
  );
});

test("sin colores no hay paleta de temporada", () => {
  assert.equal(getSeasonPalette([]), null);
});
