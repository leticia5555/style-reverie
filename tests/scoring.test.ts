import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeSourceCount,
  computeScore,
  CONFIRMING_SIGNAL_THRESHOLD,
  momentum,
  SOURCE_WEIGHTS,
  yoyChange,
} from "@/lib/scoring";
import { SOURCES, type SourceKey } from "@/lib/types";

const signals = (values: Partial<Record<SourceKey, number>>, base = 0) =>
  Object.fromEntries(
    SOURCES.map((source) => [source, values[source] ?? base]),
  ) as Record<SourceKey, number>;

test("los pesos conceptuales suman exactamente 1", () => {
  const total = SOURCES.reduce((acc, s) => acc + SOURCE_WEIGHTS[s], 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `suman ${total}`);
});

test("todas las señales al mismo valor devuelven ese valor", () => {
  assert.equal(computeScore(signals({}, 50)), 50);
  assert.equal(computeScore(signals({}, 0)), 0);
  assert.equal(computeScore(signals({}, 100)), 100);
});

test("el score es el promedio ponderado de las fuentes presentes", () => {
  // signals() rellena todas las fuentes, así que aquí siempre están las seis
  // que participan y los pesos se reescalan por 1/0.82.
  const escala = 0.82;
  assert.equal(
    computeScore(signals({ google_trends: 100 })),
    Math.round((0.2 / escala) * 100 * 10) / 10,
  );
  assert.equal(
    computeScore(signals({ amazon: 100 })),
    Math.round((0.07 / escala) * 100 * 10) / 10,
  );
  // Pinterest no participa: ponerlo a 40 no cambia nada.
  assert.equal(
    computeScore(signals({ google_trends: 80, pinterest: 40 })),
    computeScore(signals({ google_trends: 80 })),
  );
});

test("búsqueda pesa más que social, y amazon es el que menos pesa", () => {
  assert.ok(SOURCE_WEIGHTS.google_trends > SOURCE_WEIGHTS.tiktok);
  assert.ok(SOURCE_WEIGHTS.mercadolibre > SOURCE_WEIGHTS.instagram);
  const menor = SOURCES.reduce((a, b) =>
    SOURCE_WEIGHTS[a] <= SOURCE_WEIGHTS[b] ? a : b,
  );
  assert.equal(menor, "amazon");
});

test("el score se recorta al rango 0–100", () => {
  assert.equal(computeScore(signals({}, 250)), 100);
  assert.equal(computeScore(signals({}, -50)), 0);
});

test("momentum es la diferencia contra el score de hace siete días", () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    signals: signals({}, 40 + i),
  }));
  // Último = 49, hace 7 días = 42.
  assert.equal(momentum(history), 7);
});

test("una serie plana tiene momentum cero", () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    signals: signals({}, 60),
  }));
  assert.equal(momentum(history), 0);
});

test("la variación anual es porcentual y protege contra división por cero", () => {
  assert.equal(yoyChange(60, 30), 100);
  assert.equal(yoyChange(30, 60), -50);
  assert.equal(yoyChange(50, 0), 0);
});

test("solo cuentan como fuente activa las que superan el umbral", () => {
  const umbral = CONFIRMING_SIGNAL_THRESHOLD;
  assert.equal(activeSourceCount(signals({}, umbral - 0.1)), 0);
  // Seis: las siete menos Pinterest, que no participa.
  assert.equal(activeSourceCount(signals({}, umbral)), 6);
  assert.equal(
    activeSourceCount(signals({ google_trends: 90, tiktok: 90 }, 10)),
    2,
  );
});
